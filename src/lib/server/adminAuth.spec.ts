import { describe, it, expect } from 'vitest';
import { requireAdminPage, requireAdminApi } from '@src/lib/server/adminAuth';
import { emptyAuthContext, type AuthContext } from '@src/lib/rbac';

function fakeLocals(bundle: {
  session?: unknown;
  user?: unknown;
  roles?: AuthContext;
}): App.Locals {
  return {
    safeGetSession: async () => ({
      session: bundle.session ?? null,
      user: bundle.user ?? null,
      profile: null,
      roles: bundle.roles ?? emptyAuthContext()
    })
  } as unknown as App.Locals;
}

const adminRoles: AuthContext = {
  userId: 'admin-1',
  platformRole: 'admin',
  orgRoles: {}
};

const researcherRoles: AuthContext = {
  userId: 'res-1',
  platformRole: 'researcher',
  orgRoles: {}
};

const signedIn = (roles: AuthContext, email = 'someone@else.com') =>
  fakeLocals({ session: { access_token: 'x' }, user: { id: roles.userId, email }, roles });

describe('requireAdminPage (page guard)', () => {
  it('redirects when there is no session', async () => {
    await expect(requireAdminPage(fakeLocals({ session: null, user: null }))).rejects.toMatchObject(
      { status: 302 }
    );
  });

  it('throws 403 when the user cannot view the admin dashboard', async () => {
    const locals = signedIn({ userId: 'u', platformRole: 'organizer', orgRoles: {} });
    await expect(requireAdminPage(locals)).rejects.toMatchObject({ status: 403 });
  });

  it('lets a researcher view but not manage', async () => {
    const ctx = await requireAdminPage(signedIn(researcherRoles));
    expect(ctx.roles.platformRole).toBe('researcher');
    await expect(
      requireAdminPage(signedIn(researcherRoles), 'platform:manage_orgs')
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns context for a platform admin', async () => {
    const ctx = await requireAdminPage(signedIn(adminRoles, 'admin@system.org'));
    expect(ctx.email).toBe('admin@system.org');
    expect(ctx.roles.platformRole).toBe('admin');
  });
});

describe('requireAdminApi (endpoint guard)', () => {
  it('throws 401 when there is no session', async () => {
    await expect(
      requireAdminApi(fakeLocals({ session: null, user: null }), 'platform:manage_orgs')
    ).rejects.toMatchObject({ status: 401 });
  });

  it('throws 403 when the user lacks the manage permission', async () => {
    await expect(
      requireAdminApi(signedIn(researcherRoles), 'platform:manage_orgs')
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      requireAdminApi(signedIn(researcherRoles), 'platform:manage_users')
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      requireAdminApi(signedIn(researcherRoles), 'platform:manage_drivers')
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns context for a platform admin', async () => {
    const ctx = await requireAdminApi(
      signedIn(adminRoles, 'admin@system.org'),
      'platform:manage_orgs'
    );
    expect(ctx.email).toBe('admin@system.org');
  });
});
