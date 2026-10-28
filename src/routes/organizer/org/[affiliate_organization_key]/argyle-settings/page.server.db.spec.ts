import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { randomUUID } from 'crypto';
import { load } from './+page.server';
import { supabase } from '@src/lib/server/db';
import { encrypt } from '@src/lib/server/encryption';

const buildEvent = (params: { affiliate_organization_key: string }, userId: string | null) =>
  ({
    params,
    locals: {
      safeGetSession: async () => ({
        user: userId ? ({ id: userId } as { id: string }) : null,
        session: userId ? {} : null,
        roles: {
          userId: userId ?? '',
          platformRole: null,
          orgRoles: userId ? { [params.affiliate_organization_key]: 'lead_organizer' } : {}
        }
      }),
      supabase
    }
  }) as unknown as Parameters<typeof load>[0];

describe('argyle-settings page server load', () => {
  const orgKey = `as-${randomUUID().slice(0, 6)}`;
  let orgId: string;
  let organizerUserId: string;

  beforeEach(async () => {
    const { data: org } = await supabase
      .from('affiliate_organizations')
      .upsert(
        { key: orgKey, name: 'Argyle Settings Test', status: 'active' },
        { onConflict: 'key' }
      )
      .select('id')
      .single();
    orgId = org!.id;

    const created = await supabase.auth.admin.createUser({
      email: `argyle-settings-organizer-${randomUUID()}@test.test`,
      email_confirm: true
    });
    organizerUserId = created.data.user!.id;

    await supabase.from('organization_members').insert({
      user_id: organizerUserId,
      organization_id: orgId,
      role: 'lead_organizer'
    });
  });

  afterEach(async () => {
    await supabase.from('organization_argyle_configs').delete().eq('organization_id', orgId);
    await supabase.from('organization_members').delete().eq('user_id', organizerUserId);
    await supabase.auth.admin.deleteUser(organizerUserId);
    await supabase.from('affiliate_organizations').delete().eq('id', orgId);
  });

  it('returns organization + null argyleConfig when org has no Argyle config', async () => {
    const result = await load(buildEvent({ affiliate_organization_key: orgKey }, organizerUserId));
    if ('error' in result) throw new Error('unexpected error result');
    expect(result.organization.key).toBe(orgKey);
    expect(result.argyleConfig).toBeNull();
    expect(result.requiresSignupCode).toBe(false);
    expect(result.driverSignupCode).toBe('');
  });

  it('returns driverSignupCode for organizer editing when a code is set', async () => {
    await supabase
      .from('affiliate_organizations')
      .update({ driver_signup_code: 'secret-code' })
      .eq('id', orgId);

    const result = await load(buildEvent({ affiliate_organization_key: orgKey }, organizerUserId));
    if ('error' in result) throw new Error('unexpected error result');
    expect(result.requiresSignupCode).toBe(true);
    expect(result.driverSignupCode).toBe('secret-code');
  });

  it('returns hasCredentials=true without exposing api_key_secret or webhook_secret', async () => {
    await supabase.from('organization_argyle_configs').upsert(
      {
        organization_id: orgId,
        api_key_id: 'k',
        api_key_secret: encrypt('s', orgId),
        webhook_secret: encrypt('w', orgId),
        link_url: 'https://api-sandbox.argyle.com',
        is_active: true,
        max_argyle_accounts: 100
      },
      { onConflict: 'organization_id' }
    );

    const result = await load(buildEvent({ affiliate_organization_key: orgKey }, organizerUserId));
    if ('error' in result) throw new Error('unexpected error result');

    expect(result.argyleConfig?.hasCredentials).toBe(true);
    expect(result.argyleConfig?.isActive).toBe(true);
    expect(result.argyleConfig?.maxArgyleAccounts).toBe(100);

    const allowedFields = new Set([
      'apiKeyId',
      'flowId',
      'maxArgyleAccounts',
      'isActive',
      'hasCredentials',
      'hasWebhookSubscription'
    ]);
    for (const key of Object.keys(result.argyleConfig!)) {
      expect(allowedFields.has(key), `unexpected leaked field "${key}"`).toBe(true);
    }
    expect(JSON.stringify(result)).not.toContain('"s"');
    expect(JSON.stringify(result)).not.toContain('"w"');
  });

  it('redirects when user is not signed in', async () => {
    await expect(
      load(buildEvent({ affiliate_organization_key: orgKey }, null))
    ).rejects.toMatchObject({ status: 302 });
  });
});

describe('argyle-settings sharing drivers', () => {
  const orgKey = `asd-${randomUUID().slice(0, 6)}`;
  const otherOrgKey = `asd-other-${randomUUID().slice(0, 6)}`;

  const insertOrg = async (key: string) => {
    const { data, error } = await supabase
      .from('affiliate_organizations')
      .insert({ key, name: `Sharing ${key}`, status: 'active' })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('org insert failed');
    onTestFinished(async () => {
      await supabase.from('affiliate_organizations').delete().eq('id', data.id);
    });
    return data.id;
  };

  const createDriver = async (
    firstName: string,
    affiliations: { organizationId: string; isPrimary: boolean }[],
    argyleAccount?: { organizationId: string | null; deleted?: boolean }
  ) => {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: `argyle-settings-driver-${randomUUID()}@test.test`,
      email_confirm: true
    });
    if (error || !created.user) throw error ?? new Error('createUser failed');
    const userId = created.user.id;
    // Registered before any dependent row so a failed insert still cleans up.
    // Accounts go first: argyle_accounts.organization_id restricts org deletes.
    onTestFinished(async () => {
      await supabase.from('argyle_accounts').delete().eq('user_id', userId);
      await supabase.auth.admin.deleteUser(userId);
    });

    const check = ({ error: writeError }: { error: unknown }) => {
      if (writeError) throw writeError;
    };

    check(
      await supabase
        .from('profiles')
        .update({ first_name: firstName, last_initial: 'T' })
        .eq('user_id', userId)
    );

    for (const { organizationId, isPrimary } of affiliations) {
      check(
        await supabase.from('driver_affiliate_organization_affiliations').insert({
          user_id: userId,
          affiliate_organization_id: organizationId,
          is_primary: isPrimary
        })
      );
      check(
        await supabase.from('driver_affiliate_organization_data_sharing_consents').insert({
          user_id: userId,
          affiliate_organization_id: organizationId
        })
      );
    }

    if (argyleAccount) {
      check(
        await supabase.from('argyle_accounts').insert({
          user_id: userId,
          argyle_user: randomUUID(),
          argyle_account: randomUUID(),
          organization_id: argyleAccount.organizationId,
          deleted_at: argyleAccount.deleted ? new Date().toISOString() : null
        })
      );
    }

    return userId;
  };

  const loadAs = (roles: { platformRole?: 'admin' | 'researcher' | null; orgRole?: string }) =>
    load({
      params: { affiliate_organization_key: orgKey },
      locals: {
        safeGetSession: async () => ({
          user: { id: 'viewer' },
          session: {},
          roles: {
            userId: 'viewer',
            platformRole: roles.platformRole ?? null,
            orgRoles: roles.orgRole ? { [orgKey]: roles.orgRole } : {}
          }
        }),
        supabase
      }
    } as unknown as Parameters<typeof load>[0]);

  it('lists only drivers whose primary organization is this one, with sync state', async () => {
    const orgId = await insertOrg(orgKey);
    const otherOrgId = await insertOrg(otherOrgKey);

    const syncing = await createDriver('Syncing', [{ organizationId: orgId, isPrimary: true }], {
      organizationId: orgId
    });
    const disconnected = await createDriver(
      'Disconnected',
      [{ organizationId: orgId, isPrimary: true }],
      { organizationId: orgId, deleted: true }
    );
    const legacy = await createDriver('Legacy', [{ organizationId: orgId, isPrimary: true }], {
      organizationId: null
    });
    const secondary = await createDriver(
      'Secondary',
      [
        { organizationId: otherOrgId, isPrimary: true },
        { organizationId: orgId, isPrimary: false }
      ],
      { organizationId: otherOrgId }
    );

    const result = await loadAs({ orgRole: 'lead_organizer' });
    const byId = new Map(result.sharingDrivers.map((d) => [d.user_id, d]));

    expect([...byId.keys()].sort()).toEqual([syncing, disconnected, legacy].sort());
    expect(byId.has(secondary)).toBe(false);

    expect(byId.get(syncing)).toMatchObject({
      is_billed_to_organization: true,
      has_argyle_sync: true
    });
    expect(byId.get(disconnected)).toMatchObject({
      is_billed_to_organization: false,
      has_argyle_sync: false
    });
    // Accounts from before per-org credentials are billed to System, not the org.
    expect(byId.get(legacy)).toMatchObject({
      is_billed_to_organization: false,
      has_argyle_sync: true
    });

    // "Shared on" reads the first consent; it must be the one for this org.
    for (const driver of result.sharingDrivers) {
      expect(driver.driver_affiliate_organization_data_sharing_consents).toHaveLength(1);
      expect(
        driver.driver_affiliate_organization_data_sharing_consents[0].affiliate_organization.key
      ).toBe(orgKey);
    }
  });

  it('lists the drivers for a platform admin, who has no membership', async () => {
    const orgId = await insertOrg(orgKey);
    const driver = await createDriver('Admin', [{ organizationId: orgId, isPrimary: true }]);

    const result = await loadAs({ platformRole: 'admin' });
    expect(result.sharingDrivers.map((d) => d.user_id)).toEqual([driver]);
  });

  it.each([
    ['organizer', { orgRole: 'organizer' }],
    ['researcher', { platformRole: 'researcher' as const }]
  ])('refuses a %s', async (_label, roles) => {
    await insertOrg(orgKey);
    await expect(loadAs(roles)).rejects.toMatchObject({ status: 403 });
  });
});
