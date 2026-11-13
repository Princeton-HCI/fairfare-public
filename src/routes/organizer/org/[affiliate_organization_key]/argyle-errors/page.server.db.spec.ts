import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { load } from './+page.server';
import { supabase } from '@src/lib/server/db';
import type { OrganizationRole } from '@src/lib/rbac';

const buildEvent = (
  organizationKey: string,
  userId: string | null,
  orgRoles: Record<string, OrganizationRole> = {}
) =>
  ({
    params: { affiliate_organization_key: organizationKey },
    locals: {
      safeGetSession: async () => ({
        user: userId ? ({ id: userId } as { id: string }) : null,
        session: userId ? {} : null,
        roles: { userId: userId ?? '', platformRole: null, orgRoles }
      }),
      supabase
    }
  }) as unknown as Parameters<typeof load>[0];

describe('argyle-errors page server load', () => {
  const orgKey = `ae-${randomUUID().slice(0, 6)}`;
  const orgName = `Argyle Errors Test ${orgKey}`;
  const otherOrgKey = `ae-other-${randomUUID().slice(0, 6)}`;
  const otherOrgName = `Argyle Errors Other ${otherOrgKey}`;
  const userId = randomUUID();

  const errorAccount = (firstName: string, affiliateOrganization: string) => ({
    argyle_user: randomUUID(),
    argyle_account: randomUUID(),
    status: 'error',
    error_code: 'auth_required',
    user_id: randomUUID(),
    employer: 'uber',
    first_name: firstName,
    last_initial: 'T',
    email: `${firstName.toLowerCase()}@example.com`,
    affiliate_organization: affiliateOrganization
  });

  beforeEach(async () => {
    const { error: orgError } = await supabase.from('affiliate_organizations').insert([
      { key: orgKey, name: orgName, status: 'active' },
      { key: otherOrgKey, name: otherOrgName, status: 'active' }
    ]);
    if (orgError) throw orgError;

    const { error: insertError } = await supabase
      .from('argyle_error_accounts')
      .insert([
        errorAccount('ByName', orgName),
        errorAccount('ByKey', orgKey),
        errorAccount('OtherOrg', otherOrgName)
      ]);
    if (insertError) throw insertError;
  });

  afterEach(async () => {
    await supabase
      .from('argyle_error_accounts')
      .delete()
      .in('affiliate_organization', [orgName, orgKey, otherOrgName]);
    await supabase.from('affiliate_organizations').delete().in('key', [orgKey, otherOrgKey]);
  });

  it("returns only this organization's accounts, matched by name or key", async () => {
    const result = await load(buildEvent(orgKey, userId, { [orgKey]: 'organizer' }));

    expect(result.organization).toEqual({ key: orgKey, name: orgName });
    expect(result.accounts.map((a) => a.first_name).sort()).toEqual(['ByKey', 'ByName']);
  });

  it('does not send Argyle IDs or user IDs to the page', async () => {
    const result = await load(buildEvent(orgKey, userId, { [orgKey]: 'organizer' }));

    for (const account of result.accounts) {
      expect(account).not.toHaveProperty('argyle_user');
      expect(account).not.toHaveProperty('argyle_account');
      expect(account).not.toHaveProperty('user_id');
    }
  });

  it('rejects an organizer of a different organization', async () => {
    await expect(
      load(buildEvent(orgKey, userId, { [otherOrgKey]: 'lead_organizer' }))
    ).rejects.toMatchObject({ status: 403 });
  });

  it('redirects when the user is not signed in', async () => {
    await expect(load(buildEvent(orgKey, null))).rejects.toMatchObject({ status: 302 });
  });
});
