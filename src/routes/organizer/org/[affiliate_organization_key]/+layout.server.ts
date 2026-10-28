import { redirect } from '@sveltejs/kit';
import { requireCapability } from '@src/lib/server/rbac';

export async function load({ locals, params }) {
  const { session, user, roles } = await locals.safeGetSession();

  if (session === null || user === null) {
    throw redirect(302, '/organizer/login');
  }

  // `roles` already reaches every page via the root layout; this load exists
  // to be the default-deny gate for the whole `/organizer/org/[key]` group.
  requireCapability(roles, 'org:view_dashboard', params.affiliate_organization_key);
}
