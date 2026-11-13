import { error, redirect } from '@sveltejs/kit';
import { requireCapability } from '@src/lib/server/rbac';

export async function load({ locals }) {
  const { session, user, roles } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(302, '/organizer/login');
  }
  // `roles` already reaches every page via the root layout. The capability check
  // stays ahead of the 404 so a signed-in driver still gets the 403 this route
  // has always given them, rather than learning nothing from a blanket 404.
  requireCapability(roles, 'platform:view_cross_org_aggregates');
  // The aggregates page itself is retired, so there is nothing left to redirect
  // to; /admin/research 404s for every role too.
  throw error(404, 'Not found');
}
