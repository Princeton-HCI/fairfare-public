import { USER_TYPES, type Capability, type RoleScope } from './roles.config';

export { CAPABILITIES, USER_TYPES } from './roles.config';
export type { Capability, RoleScope, UserType } from './roles.config';

type UserTypeOf<S extends RoleScope> = Extract<(typeof USER_TYPES)[number], { scope: S }>;

export type PlatformRole = UserTypeOf<'platform'>['id'];
export type OrganizationRole = UserTypeOf<'organization'>['id'];

function idsForScope<S extends RoleScope>(scope: S): readonly UserTypeOf<S>['id'][] {
  return USER_TYPES.filter((t) => t.scope === scope).map((t) => t.id) as UserTypeOf<S>['id'][];
}

const PLATFORM_ROLES = idsForScope('platform');
const ORGANIZATION_ROLES = idsForScope('organization');

export function userType(scope: RoleScope, id: string | null | undefined) {
  if (!id) return null;
  return USER_TYPES.find((t) => t.scope === scope && t.id === id) ?? null;
}

export function permissionsFor(
  scope: RoleScope,
  id: string | null | undefined
): readonly Capability[] {
  return userType(scope, id)?.permissions ?? [];
}

export function userTypeLabel(scope: RoleScope, id: string | null | undefined): string {
  return userType(scope, id)?.label ?? id ?? '—';
}

/** Organization user types, for selects that assign a membership role. */
export const ORGANIZATION_USER_TYPES = USER_TYPES.filter((t) => t.scope === 'organization');

/**
 * The platform roles an admin can hand out from `/admin/platform-users`.
 *
 * `driver` and `organizer` are excluded deliberately: they are written by the
 * signup and organizer-login flows, not assigned, and offering them here would
 * turn a staff page into a way to rewrite an unrelated person's role. Removing
 * a staff role falls back to one of them rather than assigning it.
 */
export const ASSIGNABLE_PLATFORM_ROLES = ['researcher', 'admin'] as const;
export type AssignablePlatformRole = (typeof ASSIGNABLE_PLATFORM_ROLES)[number];

export const ASSIGNABLE_PLATFORM_USER_TYPES = USER_TYPES.filter(
  (t): t is Extract<(typeof USER_TYPES)[number], { scope: 'platform' }> =>
    t.scope === 'platform' && (ASSIGNABLE_PLATFORM_ROLES as readonly string[]).includes(t.id)
);

/** Coerce untrusted input (a form field, a JSON body) to an assignable platform role. */
export function parseAssignablePlatformRole(value: unknown): AssignablePlatformRole | null {
  return typeof value === 'string' &&
    (ASSIGNABLE_PLATFORM_ROLES as readonly string[]).includes(value)
    ? (value as AssignablePlatformRole)
    : null;
}

/**
 * The capability a write touching `role` requires. Granting or revoking `admin`
 * needs `platform:manage_admins`; every other staff role change needs
 * `platform:manage_users`. Callers check this for *both* the role being
 * assigned and the one being replaced, so a demotion is gated as tightly as the
 * promotion that created it.
 */
export function capabilityForPlatformRole(role: string | null | undefined): Capability {
  return role === 'admin' ? 'platform:manage_admins' : 'platform:manage_users';
}

export type AuthContext = {
  userId: string;
  platformRole: PlatformRole | null;
  /** Org key → role */
  orgRoles: Record<string, OrganizationRole>;
};

export function postLoginPath(ctx: AuthContext, organizationKey?: string | null): string {
  if (hasCapability(ctx, 'platform:view_admin_dashboard')) return '/admin';
  if (organizationKey) return `/organizer/org/${organizationKey}`;
  const keys = Object.keys(ctx.orgRoles).sort();
  if (keys[0]) return `/organizer/org/${keys[0]}`;
  return '/organizer/login';
}

export function emptyAuthContext(userId = ''): AuthContext {
  return { userId, platformRole: null, orgRoles: {} };
}

export function isPlatformRole(value: string | null | undefined): value is PlatformRole {
  return !!value && (PLATFORM_ROLES as readonly string[]).includes(value);
}

export function isOrganizationRole(value: string | null | undefined): value is OrganizationRole {
  return !!value && (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

/** Coerce untrusted input (a form field, a JSON body) to an organization role. */
export function parseOrganizationRole(value: unknown): OrganizationRole | null {
  return typeof value === 'string' && isOrganizationRole(value) ? value : null;
}

/**
 * `platform:*` capabilities ignore `organizationKey`. `org:*` capabilities
 * need one: a platform-scoped grant applies to every organization, a
 * membership grant only to the organization it belongs to.
 */
export function hasCapability(
  ctx: AuthContext | null | undefined,
  capability: Capability,
  organizationKey?: string | null
): boolean {
  if (!ctx) return false;

  const platformCaps = permissionsFor('platform', ctx.platformRole);
  if (capability.startsWith('platform:')) return platformCaps.includes(capability);

  if (!organizationKey) return false;
  if (platformCaps.includes(capability)) return true;
  // Researcher restrictions also apply to any existing organization memberships.
  if (ctx.platformRole === 'researcher') return false;

  const orgRole = ctx.orgRoles[organizationKey];
  return permissionsFor('organization', orgRole).includes(capability);
}
