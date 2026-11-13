import { requireCapability } from '@src/lib/server/rbac';
import type { PageServerLoad } from './$types';
import { error as httpError, redirect } from '@sveltejs/kit';
import short from 'short-uuid';
// Driver rows are read with the service-role client: RLS does not scope
// platform roles (a researcher has no membership), so every read below is
// scoped to the organization explicitly, in the app.
import { supabase } from '@src/lib/server/db';
import { driverBelongsToOrganization } from '@src/routes/organizer/utils.server';

export const load: PageServerLoad = async ({ params, locals }) => {
  const { session, roles } = await locals.safeGetSession();

  if (session === null) {
    throw redirect(302, '/organizer/login');
  }

  const organizationKey = params.affiliate_organization_key;

  requireCapability(roles, 'org:view_driver_pii', organizationKey);

  // Fetch driver profile
  const { driver_short_id: driverShortId } = params;
  const translator = short();
  const driverId = translator.toUUID(driverShortId);

  if (!(await driverBelongsToOrganization(supabase, driverId, organizationKey))) {
    throw httpError(404, 'Driver not found');
  }

  const { data: driverProfile, error } = await supabase
    .from('profiles')
    .select(
      `
      *,
      argyle_accounts(
        all_gigs_last_synced_at
      ),
      driver_affiliate_organization_data_sharing_consents!inner(
        created_at,
        affiliate_organization:affiliate_organizations!inner(
          name
        )
      )
    `
    )
    .eq('user_id', driverId)
    .single();

  if (error) {
    console.error(error);
    throw new Error(error?.message || 'An error occurred');
  }

  return { driverProfile, driverId };
};
