import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, url }) => {
  const { driver_short_id: driverShortId, affiliate_organization_key: affiliateOrganizationKey } =
    params;

  const { session } = await locals.safeGetSession();
  if (session === null) {
    throw redirect(302, '/organizer/login');
  }

  const queryString = url.searchParams.toString();
  const base = `/organizer/org/${affiliateOrganizationKey}/lost-wages/${driverShortId}`;
  const redirectUrl = queryString
    ? `${base}?mode=deactivation&${queryString}`
    : `${base}?mode=deactivation`;

  throw redirect(302, redirectUrl);
};
