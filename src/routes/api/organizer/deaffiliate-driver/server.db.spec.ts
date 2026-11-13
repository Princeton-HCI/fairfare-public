import { describe, expect, it, onTestFinished } from 'vitest';
import { randomUUID } from 'crypto';
import { http, HttpResponse } from 'msw';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import type { AuthContext } from '@src/lib/rbac';
import { server } from '@tests/setupTests';
import { createAuthenticatedRequestEvent } from '@tests/utils/requestEvent';

const URL = 'http://localhost/api/organizer/deaffiliate-driver';

describe('POST /api/organizer/deaffiliate-driver', () => {
  const createUser = async (prefix: string) => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `${prefix}-${randomUUID()}@test.test`,
      email_confirm: true
    });
    if (error || !data.user) throw error ?? new Error('createUser failed');
    const userId = data.user.id;
    onTestFinished(async () => {
      await supabase.from('organizer_logging').delete().eq('user_id', userId);
      await supabase.from('argyle_accounts').delete().eq('user_id', userId);
      await supabase.auth.admin.deleteUser(userId);
    });
    return userId;
  };

  /** An org with no Argyle config, so teardown resolves to the global (mocked) credentials. */
  const setUp = async () => {
    const orgKey = `deaff-${randomUUID().slice(0, 6)}`;
    const { data: org, error } = await supabase
      .from('affiliate_organizations')
      .insert({ key: orgKey, name: 'Deaffiliate Test', status: 'active' })
      .select('id')
      .single();
    if (error || !org) throw error ?? new Error('org insert failed');
    // Registered first so it runs after the users' cleanup has removed their accounts.
    onTestFinished(async () => {
      await supabase.from('affiliate_organizations').delete().eq('id', org.id);
    });

    const actorId = await createUser('deaff-actor');
    const driverId = await createUser('deaff-driver');
    const argyleUser = randomUUID();
    const argyleAccount = randomUUID();

    await supabase.from('profiles').update({ argyle_user: argyleUser }).eq('user_id', driverId);
    await supabase.from('driver_affiliate_organization_affiliations').insert({
      user_id: driverId,
      affiliate_organization_id: org.id,
      is_primary: true
    });
    await supabase.from('driver_affiliate_organization_data_sharing_consents').insert({
      user_id: driverId,
      affiliate_organization_id: org.id
    });
    await supabase.from('argyle_accounts').insert({
      user_id: driverId,
      argyle_user: argyleUser,
      argyle_account: argyleAccount,
      organization_id: org.id
    });

    const argyleDeletes: string[] = [];
    server.use(
      http.delete('http://argyletestingurl.test/v2/accounts/:id', ({ params }) => {
        argyleDeletes.push(`accounts/${params.id}`);
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete('http://argyletestingurl.test/v2/users/:id', ({ params }) => {
        argyleDeletes.push(`users/${params.id}`);
        return new HttpResponse(null, { status: 204 });
      })
    );

    return { orgKey, actorId, driverId, argyleUser, argyleAccount, argyleDeletes };
  };

  const post = (actorId: string, orgKey: string, driverId: string, roles: AuthContext) =>
    POST(
      createAuthenticatedRequestEvent(URL, {
        method: 'POST',
        userId: actorId,
        roles,
        body: { organizationKey: orgKey, driverUserId: driverId }
      })
    );

  it('disables a primary driver’s Argyle sync for a lead organizer and audits it', async () => {
    const { orgKey, actorId, driverId, argyleUser, argyleAccount, argyleDeletes } = await setUp();

    const response = await post(actorId, orgKey, driverId, {
      userId: actorId,
      platformRole: null,
      orgRoles: { [orgKey]: 'lead_organizer' }
    });
    expect(response.status).toBe(200);

    expect(argyleDeletes).toEqual([`accounts/${argyleAccount}`, `users/${argyleUser}`]);

    const { data: accounts } = await supabase
      .from('argyle_accounts')
      .select('deleted_at')
      .eq('user_id', driverId);
    expect(accounts).toHaveLength(1);
    expect(accounts![0].deleted_at).not.toBeNull();

    const { count: affiliations } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', driverId);
    const { count: consents } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', driverId);
    expect(affiliations).toBe(0);
    expect(consents).toBe(0);

    const { data: logs } = await supabase
      .from('organizer_logging')
      .select('action, additional_data')
      .eq('user_id', actorId);
    expect(logs).toEqual([
      {
        action: 'removed_driver',
        additional_data: { organizationKey: orgKey, driverUserId: driverId, wasPrimary: true }
      }
    ]);
  });

  it('refuses an organizer without driver-removal rights and changes nothing', async () => {
    const { orgKey, actorId, driverId, argyleDeletes } = await setUp();

    const response = await post(actorId, orgKey, driverId, {
      userId: actorId,
      platformRole: null,
      orgRoles: { [orgKey]: 'organizer' }
    });
    expect(response.status).toBe(403);
    expect(argyleDeletes).toEqual([]);

    const { count: affiliations } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', driverId);
    expect(affiliations).toBe(1);

    const { count: logs } = await supabase
      .from('organizer_logging')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', actorId);
    expect(logs).toBe(0);
  });
});
