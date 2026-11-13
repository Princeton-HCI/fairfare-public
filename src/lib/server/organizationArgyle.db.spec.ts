import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { supabase } from '@src/lib/server/db';
import { encrypt } from './encryption';
import { resolveArgyleCredentials } from './organizationArgyle';

const insertOrgAndConfig = async (orgKey: string) => {
  const { data: org } = await supabase
    .from('affiliate_organizations')
    .upsert({ key: orgKey, name: `Org ${orgKey}`, status: 'active' }, { onConflict: 'key' })
    .select('id')
    .single();
  if (!org) throw new Error('failed to create org');
  const orgId = org.id as string;

  await supabase.from('organization_argyle_configs').upsert(
    {
      organization_id: orgId,
      api_key_id: 'api-key-id',
      api_key_secret: encrypt('api-key-secret', orgId),
      webhook_secret: encrypt('webhook-secret', orgId),
      link_url: 'https://api-sandbox.argyle.com',
      flow_id: 'FLOW123',
      is_active: true
    },
    { onConflict: 'organization_id' }
  );

  return orgId;
};

describe('resolveArgyleCredentials', () => {
  const orgKey = `resolver-test-${randomUUID().slice(0, 8)}`;
  let orgId: string;
  let userId: string;
  const argyleUser = randomUUID();
  const argyleAccount = randomUUID();

  beforeEach(async () => {
    orgId = await insertOrgAndConfig(orgKey);

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: `resolver-${randomUUID()}@test.test`,
      email_confirm: true
    });
    if (error || !created.user) throw error ?? new Error('createUser failed');
    userId = created.user.id;

    // Primary affiliation -> by 'user' lookup hits this org
    await supabase.from('driver_affiliate_organization_affiliations').insert({
      user_id: userId,
      affiliate_organization_id: orgId,
      is_primary: true
    });

    // Argyle account -> by 'account' and 'argyleUser' lookups hit this org
    await supabase.from('argyle_accounts').insert({
      user_id: userId,
      argyle_user: argyleUser,
      argyle_account: argyleAccount,
      organization_id: orgId
    });
  });

  afterEach(async () => {
    await supabase.from('argyle_accounts').delete().eq('user_id', userId);
    await supabase
      .from('driver_affiliate_organization_affiliations')
      .delete()
      .eq('user_id', userId);
    await supabase.auth.admin.deleteUser(userId);
    await supabase.from('organization_argyle_configs').delete().eq('organization_id', orgId);
    await supabase.from('affiliate_organizations').delete().eq('id', orgId);
  });

  it('resolves by user (primary affiliation)', async () => {
    const creds = await resolveArgyleCredentials({ by: 'user', userId });
    expect(creds?.organizationId).toBe(orgId);
    expect(creds?.organizationKey).toBe(orgKey);
    expect(creds?.apiKeySecret).toBe('api-key-secret');
    expect(creds?.webhookSecret).toBe('webhook-secret');
  });

  it('resolves by account (argyle_account)', async () => {
    const creds = await resolveArgyleCredentials({ by: 'account', argyleAccount });
    expect(creds?.organizationId).toBe(orgId);
  });

  it('resolves by argyleUser', async () => {
    const creds = await resolveArgyleCredentials({ by: 'argyleUser', argyleUser });
    expect(creds?.organizationId).toBe(orgId);
  });

  it('resolves by orgKey', async () => {
    const creds = await resolveArgyleCredentials({ by: 'orgKey', organizationKey: orgKey });
    expect(creds?.organizationId).toBe(orgId);
  });

  it('still resolves by account after soft-delete (organization_id preserved)', async () => {
    await supabase
      .from('argyle_accounts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId);

    const creds = await resolveArgyleCredentials({ by: 'account', argyleAccount });
    expect(creds?.organizationId).toBe(orgId);
  });

  it('returns null for a non-existent org key', async () => {
    const creds = await resolveArgyleCredentials({
      by: 'orgKey',
      organizationKey: 'definitely-does-not-exist'
    });
    expect(creds).toBeNull();
  });

  it('returns null for a user with no primary affiliation', async () => {
    await supabase
      .from('driver_affiliate_organization_affiliations')
      .delete()
      .eq('user_id', userId);

    const creds = await resolveArgyleCredentials({ by: 'user', userId });
    expect(creds).toBeNull();
  });

  it('still returns credentials when is_active=false (inactive flag is reported on the resolved object)', async () => {
    await supabase
      .from('organization_argyle_configs')
      .update({ is_active: false })
      .eq('organization_id', orgId);

    const creds = await resolveArgyleCredentials({ by: 'orgKey', organizationKey: orgKey });
    expect(creds).not.toBeNull();
    expect(creds?.isActive).toBe(false);
  });
});
