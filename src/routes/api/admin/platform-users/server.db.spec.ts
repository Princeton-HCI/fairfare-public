import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST, PATCH, DELETE } from './+server';
import { supabase } from '@src/lib/server/db';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import type { AuthContext } from '@src/lib/rbac';

const ADMIN_EMAIL = uniqueTestEmail('adminplatformusers');
const RESEARCHER_EMAIL = uniqueTestEmail('researcher');
const DRIVER_EMAIL = uniqueTestEmail('researcherdriver');
const ROLELESS_EMAIL = uniqueTestEmail('roleless');
const SECOND_ADMIN_EMAIL = uniqueTestEmail('secondadmin');

const PASSWORD = 'researcher-password-1';
const NEW_PASSWORD = 'researcher-password-2';

let adminUserId: string;
let driverUserId: string;
let rolelessUserId: string;
let researcherUserId: string | null = null;
let secondAdminUserId: string | null = null;

const localsFor = (roles: AuthContext, email = ADMIN_EMAIL) =>
  ({
    safeGetSession: async () => ({
      session: { access_token: 'x' },
      user: { id: roles.userId, email },
      profile: null,
      roles
    })
  }) as unknown as App.Locals;

const adminLocals = () => localsFor({ userId: adminUserId, platformRole: 'admin', orgRoles: {} });

const researcherLocals = () =>
  localsFor({ userId: 'someone', platformRole: 'researcher', orgRoles: {} });

const postEvent = (locals: App.Locals, body: unknown): RequestEvent =>
  ({ locals, request: { json: async () => body } }) as unknown as RequestEvent;

const patchEvent = postEvent;

const deleteEvent = (locals: App.Locals, userId: string): RequestEvent =>
  ({
    locals,
    url: new URL(`http://localhost/api/admin/platform-users?userId=${userId}`)
  }) as unknown as RequestEvent;

const roleOf = async (userId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role ?? null;
};

/**
 * Whether the account has been through `updateUserById({ email_confirm: true })`
 * — the same call that resets the password. The fixtures are created
 * unconfirmed, so this staying null is how a test asserts that a refused
 * request wrote nothing to the account it refused.
 */
const isEmailConfirmed = async (userId: string): Promise<boolean> => {
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data.user?.email_confirmed_at != null;
};

describe('/api/admin/platform-users', () => {
  beforeAll(async () => {
    const admin = await createTestUserByEmail(ADMIN_EMAIL);
    adminUserId = admin.id;
    await supabase
      .from('user_roles')
      .upsert({ user_id: adminUserId, role: 'admin' }, { onConflict: 'user_id' });

    // A non-researcher who already has an account: submitting their address
    // must be refused rather than quietly taking the account over.
    const driver = await createTestUserByEmail(DRIVER_EMAIL);
    driverUserId = driver.id;
    await supabase
      .from('user_roles')
      .upsert({ user_id: driverUserId, role: 'driver' }, { onConflict: 'user_id' });

    // Workers never get a `user_roles` row in app code, so "account exists, no
    // role" is a real shape and the one a typo is most likely to hit.
    const roleless = await createTestUserByEmail(ROLELESS_EMAIL);
    rolelessUserId = roleless.id;
    await supabase.from('user_roles').delete().eq('user_id', rolelessUserId);
  });

  afterAll(async () => {
    await supabase.from('admin_activity_log').delete().eq('admin_user_id', adminUserId);
    for (const id of [researcherUserId, secondAdminUserId]) {
      if (!id) continue;
      await supabase.from('user_roles').delete().eq('user_id', id);
      await supabase.auth.admin.deleteUser(id);
    }
    await supabase.from('user_roles').delete().eq('user_id', rolelessUserId);
    await teardownTestUserByUserId(rolelessUserId);
    await supabase.from('user_roles').delete().eq('user_id', driverUserId);
    await teardownTestUserByUserId(driverUserId);
    await supabase.from('user_roles').delete().eq('user_id', adminUserId);
    await teardownTestUserByUserId(adminUserId);
  });

  it('rejects a researcher (view-only) with 403', async () => {
    await expect(
      POST(postEvent(researcherLocals(), { email: RESEARCHER_EMAIL, password: PASSWORD }))
    ).rejects.toMatchObject({ status: 403 });
  });

  it('requires an email', async () => {
    const res = await POST(postEvent(adminLocals(), { password: PASSWORD }));
    expect(res.status).toBe(400);
  });

  it('rejects an address that is not an email', async () => {
    const res = await POST(postEvent(adminLocals(), { email: 'not-an-email', password: PASSWORD }));
    expect(res.status).toBe(400);
  });

  it('requires a password of at least 8 characters', async () => {
    const res = await POST(
      postEvent(adminLocals(), { email: RESEARCHER_EMAIL, password: 'short' })
    );
    expect(res.status).toBe(400);
  });

  it('rejects a role that is not assignable from here', async () => {
    const res = await POST(
      postEvent(adminLocals(), { email: RESEARCHER_EMAIL, password: PASSWORD, role: 'driver' })
    );
    expect(res.status).toBe(400);
  });

  it('creates a user for a new email, assigns researcher, and writes an audit row', async () => {
    const res = await POST(
      postEvent(adminLocals(), { email: RESEARCHER_EMAIL, password: PASSWORD })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string; created: boolean };
    expect(body.created).toBe(true);
    researcherUserId = body.userId;

    expect(await roleOf(body.userId)).toBe('researcher');

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', body.userId)
      .single();
    expect(profile?.email).toBe(RESEARCHER_EMAIL);

    // Created with the password the admin typed and no confirmation email to
    // click, which is what lets them sign in at /admin/login immediately.
    expect(await isEmailConfirmed(body.userId)).toBe(true);

    const { data: audit } = await supabase
      .from('admin_activity_log')
      .select('action, target_id, metadata')
      .eq('admin_user_id', adminUserId)
      .eq('action', 'platform_user.add')
      .eq('target_id', body.userId);
    expect(audit?.length).toBe(1);
    // The password is never written to the audit trail.
    expect(JSON.stringify(audit?.[0]?.metadata)).not.toContain(PASSWORD);
  });

  it('resets the password for an existing researcher', async () => {
    const res = await POST(
      postEvent(adminLocals(), { email: RESEARCHER_EMAIL, password: NEW_PASSWORD })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string; created: boolean };
    expect(body.created).toBe(false);
    expect(body.userId).toBe(researcherUserId);
  });

  it('matches an existing account case-insensitively rather than failing', async () => {
    const res = await POST(
      postEvent(adminLocals(), { email: RESEARCHER_EMAIL.toUpperCase(), password: NEW_PASSWORD })
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { userId: string; created: boolean }).toMatchObject({
      userId: researcherUserId,
      created: false
    });
  });

  it('refuses to reset another admin through the add form, writing nothing', async () => {
    const res = await POST(
      postEvent(adminLocals(), { email: ADMIN_EMAIL, password: NEW_PASSWORD })
    );
    expect(res.status).toBe(409);
    // The guard is worthless if the password reset already happened: a 409 that
    // says "nothing changed" while the other admin is locked out of
    // /admin/login is the failure this asserts against.
    expect(await isEmailConfirmed(adminUserId)).toBe(false);
    expect(await roleOf(adminUserId)).toBe('admin');
  });

  it('refuses an existing account that is not staff, and writes nothing', async () => {
    const res = await POST(
      postEvent(adminLocals(), { email: DRIVER_EMAIL, password: NEW_PASSWORD })
    );
    expect(res.status).toBe(409);
    expect(await isEmailConfirmed(driverUserId)).toBe(false);
    expect(await roleOf(driverUserId)).toBe('driver');
  });

  it('refuses an existing account with no platform role at all', async () => {
    // The dangerous shape: a worker whose address was mistyped into the admin
    // field. Promoting them would reset their password *and* hand them the role.
    const res = await POST(
      postEvent(adminLocals(), { email: ROLELESS_EMAIL, password: NEW_PASSWORD, role: 'admin' })
    );
    expect(res.status).toBe(409);
    expect(await isEmailConfirmed(rolelessUserId)).toBe(false);
    expect(await roleOf(rolelessUserId)).toBe(null);
  });

  it('creates a second admin from the add form', async () => {
    const res = await POST(
      postEvent(adminLocals(), { email: SECOND_ADMIN_EMAIL, password: PASSWORD, role: 'admin' })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string; role: string; created: boolean };
    secondAdminUserId = body.userId;
    expect(body.role).toBe('admin');
    expect(await roleOf(body.userId)).toBe('admin');
  });

  it('promotes a researcher to admin without touching their credentials', async () => {
    const { data: before } = await supabase.auth.admin.getUserById(researcherUserId!);

    const res = await PATCH(patchEvent(adminLocals(), { userId: researcherUserId, role: 'admin' }));
    expect(res.status).toBe(200);
    expect(await roleOf(researcherUserId!)).toBe('admin');

    // A promotion that rewrote the password would lock the person out of the
    // account it just promoted.
    const { data: after } = await supabase.auth.admin.getUserById(researcherUserId!);
    expect(after.user?.updated_at).toBe(before.user?.updated_at);

    const { data: audit } = await supabase
      .from('admin_activity_log')
      .select('metadata')
      .eq('admin_user_id', adminUserId)
      .eq('action', 'platform_user.role_changed')
      .eq('target_id', researcherUserId!);
    expect(audit?.[0]?.metadata).toMatchObject({ from: 'researcher', to: 'admin' });
  });

  it('demotes an admin back to researcher', async () => {
    const res = await PATCH(
      patchEvent(adminLocals(), { userId: researcherUserId, role: 'researcher' })
    );
    expect(res.status).toBe(200);
    expect(await roleOf(researcherUserId!)).toBe('researcher');
  });

  it('refuses to change or remove your own role', async () => {
    const patchRes = await PATCH(
      patchEvent(adminLocals(), { userId: adminUserId, role: 'researcher' })
    );
    expect(patchRes.status).toBe(409);

    const deleteRes = await DELETE(deleteEvent(adminLocals(), adminUserId));
    expect(deleteRes.status).toBe(409);

    expect(await roleOf(adminUserId)).toBe('admin');
  });

  it('refuses to promote a user who is not already staff', async () => {
    // The UI only lists staff, but the endpoint is the boundary: a raw call
    // with a worker's id must not be a second door to the escalation POST
    // refuses.
    for (const target of [driverUserId, rolelessUserId]) {
      const res = await PATCH(patchEvent(adminLocals(), { userId: target, role: 'admin' }));
      expect(res.status).toBe(409);
    }
    expect(await roleOf(driverUserId)).toBe('driver');
    expect(await roleOf(rolelessUserId)).toBe(null);
  });

  it('refuses to remove a user who holds no staff role', async () => {
    const res = await DELETE(deleteEvent(adminLocals(), driverUserId));
    expect(res.status).toBe(409);
    expect(await roleOf(driverUserId)).toBe('driver');
  });

  it('removes another admin and falls back to driver', async () => {
    const res = await DELETE(deleteEvent(adminLocals(), secondAdminUserId!));
    expect(res.status).toBe(200);
    expect(await roleOf(secondAdminUserId!)).toBe('driver');
  });

  it('removes the researcher role and falls back to driver', async () => {
    const res = await DELETE(deleteEvent(adminLocals(), researcherUserId!));
    expect(res.status).toBe(200);
    expect(await roleOf(researcherUserId!)).toBe('driver');
  });
});
