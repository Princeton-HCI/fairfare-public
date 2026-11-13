import { error, redirect } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import { hasCapability, type AuthContext, type Capability } from '@src/lib/rbac';

/**
 * The admin area is capability-gated. `platform:view_admin_dashboard` opens the
 * pages (platform admins and researchers); each write endpoint requires the
 * specific `platform:manage_*` permission it exercises, which only admins hold.
 * See `src/lib/roles.config.ts`. Provision admins with `pnpm seed:admins`.
 */

/** Normalize an email to a canonical comparison form (trimmed, lowercased). */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface AdminContext {
  user: User;
  email: string;
  roles: AuthContext;
}

/**
 * Shared body of the two admin guards. `onAnonymous` is what distinguishes a
 * page (redirect to the login form) from a JSON endpoint (401), so the
 * capability check and the returned context stay in one place.
 */
async function requireAdmin(
  locals: App.Locals,
  capability: Capability,
  onAnonymous: () => never
): Promise<AdminContext> {
  const { session, user, roles } = await locals.safeGetSession();

  if (session === null || user === null) {
    onAnonymous();
  }

  if (!hasCapability(roles, capability)) {
    throw error(403, 'Admin access required');
  }

  return { user, email: normalizeEmail(user.email ?? ''), roles };
}

/**
 * Guard for admin pages. MUST be called before any service-role query in a
 * `load`.
 *
 * - Redirects to `/admin/login` when there is no session.
 * - Throws 403 when the user lacks `capability` (default: view the dashboard).
 * - Returns the admin context (used for audit logging) on success.
 */
export function requireAdminPage(
  locals: App.Locals,
  capability: Capability = 'platform:view_admin_dashboard'
): Promise<AdminContext> {
  return requireAdmin(locals, capability, () => {
    throw redirect(302, '/admin/login');
  });
}

/**
 * Guard for `/api/admin/*` JSON endpoints. Responds with HTTP error statuses
 * (401/403) instead of redirecting, so `fetch` callers get a real error rather
 * than the login page HTML. `capability` is the `platform:manage_*` permission
 * the endpoint exercises.
 */
export function requireAdminApi(locals: App.Locals, capability: Capability): Promise<AdminContext> {
  return requireAdmin(locals, capability, () => {
    throw error(401, 'Unauthorized');
  });
}
