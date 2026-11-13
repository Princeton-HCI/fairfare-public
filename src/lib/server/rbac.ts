import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyAuthContext,
  hasCapability,
  isOrganizationRole,
  isPlatformRole,
  type AuthContext,
  type Capability,
  type OrganizationRole
} from '@src/lib/rbac';

type EmbeddedOrganization = { key: string; status: string };

/** PostgREST returns a many-to-one embed as an object; the generated types say array. */
const embeddedOrganization = (
  value: EmbeddedOrganization | EmbeddedOrganization[] | null | undefined
): EmbeddedOrganization | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

export async function loadAuthContext(
  supabase: SupabaseClient,
  userId: string
): Promise<AuthContext> {
  if (!userId) return emptyAuthContext();

  const [{ data: roleRow, error: roleError }, { data: memberships, error: membershipError }] =
    await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      // Memberships in soft-deleted organizations grant nothing: this filter is
      // what makes the admin "soft-delete" actually hide an organization from
      // its organizers. The key is embedded so the context loads in one query.
      supabase
        .from('organization_members')
        .select('role, affiliate_organizations!inner(key, status)')
        .eq('user_id', userId)
        .eq('affiliate_organizations.status', 'active')
    ]);

  // A failed lookup yields an empty context (fail closed → 403). Log it so an
  // outage is distinguishable from a genuine permissions problem.
  if (roleError) {
    console.error('Failed to load platform role for RBAC', roleError);
  }
  if (membershipError) {
    console.error('Failed to load organization memberships for RBAC', membershipError);
  }

  const orgRoles: Record<string, OrganizationRole> = {};
  for (const row of memberships ?? []) {
    const key = embeddedOrganization(row.affiliate_organizations)?.key;
    if (key && isOrganizationRole(row.role)) {
      orgRoles[key] = row.role;
    }
  }

  return {
    userId,
    platformRole: isPlatformRole(roleRow?.role) ? roleRow.role : null,
    orgRoles
  };
}

export function requireCapability(
  ctx: AuthContext | null | undefined,
  capability: Capability,
  organizationKey?: string | null
): AuthContext {
  if (!hasCapability(ctx, capability, organizationKey)) {
    throw error(403, 'You do not have access to this resource');
  }
  return ctx as AuthContext;
}
