import { describe, expect, it } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { requireCapability } from '@src/lib/server/rbac';
import {
  ASSIGNABLE_PLATFORM_USER_TYPES,
  CAPABILITIES,
  USER_TYPES,
  capabilityForPlatformRole,
  emptyAuthContext,
  hasCapability,
  parseAssignablePlatformRole,
  permissionsFor,
  postLoginPath,
  type AuthContext
} from './rbac';

const organizer: AuthContext = {
  userId: 'u1',
  platformRole: 'organizer',
  orgRoles: { du: 'organizer', pelq: 'organizer' }
};

const lead: AuthContext = {
  userId: 'u2',
  platformRole: 'organizer',
  orgRoles: { du: 'lead_organizer' }
};

const researcher: AuthContext = {
  userId: 'u3',
  platformRole: 'researcher',
  orgRoles: {}
};

const admin: AuthContext = {
  userId: 'u4',
  platformRole: 'admin',
  orgRoles: {}
};

describe('USER_TYPES config', () => {
  it('has unique (scope, id) pairs and only known capabilities', () => {
    const keys = USER_TYPES.map((t) => `${t.scope}:${t.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const type of USER_TYPES) {
      for (const permission of type.permissions) {
        expect(CAPABILITIES).toContain(permission);
      }
    }
  });

  it('gives the doc roles their permission sets', () => {
    expect(permissionsFor('organization', 'organizer')).not.toContain('org:deaffiliate_driver');
    expect(permissionsFor('organization', 'organizer')).not.toContain('org:manage_members');
    expect(permissionsFor('organization', 'lead_organizer')).toEqual(
      expect.arrayContaining([
        'org:deaffiliate_driver',
        'org:manage_argyle_settings',
        'org:manage_signup_code',
        'org:manage_members'
      ])
    );
    expect(permissionsFor('platform', 'researcher')).not.toContain('org:export_driver_data');
    expect(permissionsFor('platform', 'researcher')).not.toContain('platform:manage_orgs');
    expect(permissionsFor('platform', 'admin')).toEqual(CAPABILITIES);
    expect(permissionsFor('platform', 'driver')).toEqual([]);
    expect(permissionsFor('platform', 'organizer')).toEqual([]);
    expect(permissionsFor('platform', 'nope')).toEqual([]);
  });
});

describe('platform role assignment', () => {
  it('offers only researcher and admin, never the roles signup writes', () => {
    expect(ASSIGNABLE_PLATFORM_USER_TYPES.map((t) => t.id)).toEqual(['researcher', 'admin']);
    expect(parseAssignablePlatformRole('admin')).toBe('admin');
    expect(parseAssignablePlatformRole('researcher')).toBe('researcher');
    for (const value of ['driver', 'organizer', 'lead_organizer', '', null, undefined, 7, {}]) {
      expect(parseAssignablePlatformRole(value)).toBe(null);
    }
  });

  it('gates admin on its own capability, so only admins can add or remove admins', () => {
    expect(capabilityForPlatformRole('admin')).toBe('platform:manage_admins');
    expect(capabilityForPlatformRole('researcher')).toBe('platform:manage_users');
    expect(capabilityForPlatformRole(null)).toBe('platform:manage_users');

    // The whole point of the separate capability: `platform:manage_admins` must
    // be held by admins alone, or it is just an alias for manage_users.
    const holders = USER_TYPES.filter((t) =>
      (t.permissions as readonly string[]).includes('platform:manage_admins')
    );
    expect(holders.map((t) => `${t.scope}:${t.id}`)).toEqual(['platform:admin']);
  });
});

describe('hasCapability', () => {
  it('returns false without a context', () => {
    expect(hasCapability(null, 'org:view_dashboard', 'du')).toBe(false);
    expect(hasCapability(emptyAuthContext(), 'org:view_dashboard', 'du')).toBe(false);
  });

  it('lets an organizer view and export at their org but not another', () => {
    expect(hasCapability(organizer, 'org:view_dashboard', 'du')).toBe(true);
    expect(hasCapability(organizer, 'org:export_driver_data', 'du')).toBe(true);
    expect(hasCapability(organizer, 'org:view_dashboard', 'other')).toBe(false);
    expect(hasCapability(organizer, 'org:manage_members', 'du')).toBe(false);
    expect(hasCapability(organizer, 'org:deaffiliate_driver', 'du')).toBe(false);
    expect(hasCapability(organizer, 'platform:view_cross_org_aggregates')).toBe(false);
    expect(hasCapability(organizer, 'platform:view_admin_dashboard')).toBe(false);
  });

  it('lets a lead organizer manage members, settings, and driver removal at their org only', () => {
    expect(hasCapability(lead, 'org:manage_members', 'du')).toBe(true);
    expect(hasCapability(lead, 'org:manage_argyle_settings', 'du')).toBe(true);
    expect(hasCapability(lead, 'org:deaffiliate_driver', 'du')).toBe(true);
    expect(hasCapability(lead, 'org:manage_members', 'pelq')).toBe(false);
  });

  it('lets a researcher read every org dashboard and the admin area but never export or manage', () => {
    expect(hasCapability(researcher, 'platform:view_cross_org_aggregates')).toBe(true);
    expect(hasCapability(researcher, 'platform:view_admin_dashboard')).toBe(true);
    expect(hasCapability(researcher, 'org:view_dashboard', 'du')).toBe(true);
    expect(hasCapability(researcher, 'org:view_driver_pii', 'any-org')).toBe(true);
    expect(hasCapability(researcher, 'org:export_driver_data', 'du')).toBe(false);
    expect(hasCapability(researcher, 'org:deaffiliate_driver', 'du')).toBe(false);
    expect(hasCapability(researcher, 'org:manage_argyle_settings', 'du')).toBe(false);
    expect(hasCapability(researcher, 'org:manage_members', 'du')).toBe(false);
    expect(hasCapability(researcher, 'platform:view_audit_log')).toBe(false);
    expect(hasCapability(researcher, 'platform:export_cross_org_data')).toBe(false);
    expect(hasCapability(researcher, 'platform:manage_orgs')).toBe(false);
    expect(hasCapability(researcher, 'platform:manage_users')).toBe(false);
    expect(hasCapability(researcher, 'platform:manage_admins')).toBe(false);
    expect(hasCapability(researcher, 'platform:manage_drivers')).toBe(false);
  });

  it('lets an admin do everything without an org membership', () => {
    expect(hasCapability(admin, 'org:manage_members', 'du')).toBe(true);
    expect(hasCapability(admin, 'org:export_driver_data', 'du')).toBe(true);
    expect(hasCapability(admin, 'platform:manage_users')).toBe(true);
    expect(hasCapability(admin, 'platform:manage_admins')).toBe(true);
    expect(hasCapability(admin, 'platform:export_cross_org_data')).toBe(true);
    expect(hasCapability(admin, 'platform:view_cross_org_aggregates')).toBe(true);
    expect(hasCapability(admin, 'platform:view_audit_log')).toBe(true);
  });

  it('requires an organization key for org capabilities, even for admins', () => {
    expect(hasCapability(admin, 'org:view_dashboard')).toBe(false);
    expect(hasCapability(researcher, 'org:view_dashboard', null)).toBe(false);
    expect(hasCapability(organizer, 'org:view_dashboard', '')).toBe(false);
  });
});

describe('postLoginPath', () => {
  it('routes admin, researcher, and organizers to the right surface', () => {
    expect(postLoginPath(admin)).toBe('/admin');
    expect(postLoginPath(researcher)).toBe('/admin');
    expect(postLoginPath(organizer, 'pelq')).toBe('/organizer/org/pelq');
    expect(postLoginPath(organizer)).toBe('/organizer/org/du');
    expect(postLoginPath(emptyAuthContext('x'))).toBe('/organizer/login');
  });
});

describe('requireCapability', () => {
  it('returns the context when the capability is present', () => {
    expect(requireCapability(lead, 'org:manage_members', 'du')).toBe(lead);
    expect(requireCapability(admin, 'platform:manage_users')).toBe(admin);
    expect(requireCapability(researcher, 'org:view_driver_pii', 'du')).toBe(researcher);
  });

  it('throws 403 when the capability is missing', () => {
    try {
      requireCapability(organizer, 'org:manage_members', 'du');
      throw new Error('expected requireCapability to throw');
    } catch (error) {
      expect(isHttpError(error)).toBe(true);
      if (isHttpError(error)) expect(error.status).toBe(403);
    }

    try {
      requireCapability(researcher, 'org:export_driver_data', 'du');
      throw new Error('expected requireCapability to throw');
    } catch (error) {
      expect(isHttpError(error)).toBe(true);
      if (isHttpError(error)) expect(error.status).toBe(403);
    }
  });
});

describe('researcher restrictions override organization memberships', () => {
  it.each(['organizer', 'lead_organizer'] as const)(
    'does not regain write or export permissions through %s',
    (role) => {
      const ctx: AuthContext = { ...researcher, orgRoles: { du: role } };
      expect(hasCapability(ctx, 'org:view_dashboard', 'du')).toBe(true);
      expect(hasCapability(ctx, 'org:view_driver_pii', 'du')).toBe(true);
      for (const capability of CAPABILITIES.filter(
        (capability) =>
          capability.startsWith('org:') &&
          !['org:view_dashboard', 'org:view_driver_pii'].includes(capability)
      )) {
        expect(hasCapability(ctx, capability, 'du'), capability).toBe(false);
      }
      expect(() => requireCapability(ctx, 'org:export_driver_data', 'du')).toThrow();
      expect(() => requireCapability(ctx, 'org:manage_members', 'du')).toThrow();
    }
  );
});
