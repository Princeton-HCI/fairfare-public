/**
 * The single list of System user types.
 *
 * Each entry is one user type: a stable `id`, the `scope` that says which table
 * stores the assignment (`platform` → `user_roles`, `organization` →
 * `organization_members`), a human label for admin UIs, and the set of
 * permissions the type grants. There is no hierarchy or "class" concept —
 * to change what a user type can do, edit its `permissions` here.
 *
 * `org:*` permissions on a `platform`-scoped type apply to every organization,
 * enforced in the app by `hasCapability`. On the SQL side, RLS (`has_org_role`)
 * grants driver-row access only to platform `admin` and organization members —
 * researchers deliberately get no row-level grant (that would be a bulk export
 * over PostgREST), so their dashboard reads run through the service-role client
 * with explicit organization scoping. See `docs/rbac.md`.
 */

export const CAPABILITIES = [
  // Organization-scoped
  'org:view_dashboard',
  'org:view_driver_pii',
  'org:export_driver_data',
  'org:deaffiliate_driver',
  'org:manage_argyle_settings',
  'org:manage_signup_code',
  'org:manage_members',
  // Platform-wide
  'platform:view_cross_org_aggregates',
  'platform:export_cross_org_data',
  'platform:view_admin_dashboard',
  'platform:view_audit_log',
  'platform:manage_orgs',
  'platform:manage_users',
  // Granting or revoking the `admin` platform role is the one escalation that
  // hands over every other capability, so it is gated separately from
  // `platform:manage_users` (which covers researchers and organizers). Only
  // `admin` holds it today; the split is what lets a future operations role
  // manage researchers without being able to mint admins.
  'platform:manage_admins',
  'platform:manage_drivers'
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export type RoleScope = 'platform' | 'organization';

export interface UserType {
  id: string;
  scope: RoleScope;
  label: string;
  description: string;
  permissions: readonly Capability[];
}

const ORGANIZER_PERMISSIONS = [
  'org:view_dashboard',
  'org:view_driver_pii',
  'org:export_driver_data'
] as const satisfies readonly Capability[];

export const USER_TYPES = [
  {
    id: 'driver',
    scope: 'platform',
    label: 'Worker',
    description:
      'A gig worker who signs up, links their work accounts, and chooses which partner organizations to share data with. Authorized as the owner of their own rows.',
    permissions: []
  },
  {
    id: 'organizer',
    scope: 'platform',
    label: 'Organizer (legacy)',
    description:
      'Legacy platform value still written at organizer login. Ignored by guards; organizer access comes from organization membership.',
    permissions: []
  },
  {
    id: 'researcher',
    scope: 'platform',
    label: 'Researcher',
    description:
      'Works with the platform team for a project or period. Signs in at /admin/login with an email and password issued by an admin. Can open every organization dashboard (except settings and team) and the admin dashboard read-only. Cannot see the audit log, download individual workers’ data, or change anything.',
    permissions: [
      'platform:view_cross_org_aggregates',
      'platform:view_admin_dashboard',
      'org:view_dashboard',
      'org:view_driver_pii'
    ]
  },
  {
    id: 'admin',
    scope: 'platform',
    label: 'Developer administrator',
    description:
      'Core platform team. Manages partner organizations, organizer administrators, researchers, and worker data sharing. Has every permission across every organization.',
    permissions: CAPABILITIES
  },
  {
    id: 'organizer',
    scope: 'organization',
    label: 'Organizer',
    description:
      'Works at a partner organization. Uses every feature of that organization’s dashboard except the Argyle settings and team pages.',
    permissions: ORGANIZER_PERMISSIONS
  },
  {
    id: 'lead_organizer',
    scope: 'organization',
    label: 'Organizer administrator',
    description:
      'Works at a partner organization and administers its dashboard: Argyle settings, sign-up limits and codes, removing drivers, and adding or removing other organizers.',
    permissions: [
      ...ORGANIZER_PERMISSIONS,
      'org:deaffiliate_driver',
      'org:manage_argyle_settings',
      'org:manage_signup_code',
      'org:manage_members'
    ]
  }
] as const satisfies readonly UserType[];
