import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import short from 'short-uuid';
// Driver rows are read with the service-role client: RLS does not scope
// platform roles (a researcher has no membership), so every read below is
// scoped to the organization explicitly, in the app.
import { supabase } from '@src/lib/server/db';
import { requireCapability } from '@src/lib/server/rbac';
import { driverBelongsToOrganization } from '@src/routes/organizer/utils.server';

export const load: PageServerLoad = async ({ params, locals }) => {
  const { driver_short_id: driverShortId, affiliate_organization_key: organizationKey } = params;
  const translator = short();
  const driverId = translator.toUUID(driverShortId);

  const { session, roles } = await locals.safeGetSession();
  if (session === null) {
    throw redirect(302, '/organizer/login');
  }

  // Driver-level pages need the PII capability on this organization.
  requireCapability(roles, 'org:view_driver_pii', organizationKey);

  if (!(await driverBelongsToOrganization(supabase, driverId, organizationKey))) {
    throw error(404, 'Driver not found');
  }

  // Run these queries in parallel
  const [
    { data: mostRecentOneHundredActivities, error: activitiesError },
    { data: driverProfile, error: profileError },
    { count: driverLifetimeTripsCount, error: countError }
  ] = await Promise.all([
    supabase
      .from('argyle_driver_activities')
      .select('*')
      .eq('user', driverId)
      .order('start_datetime', { ascending: false })
      .limit(100),
    supabase
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
      .single(),
    supabase
      .from('argyle_driver_activities')
      .select('*', { count: 'exact', head: true })
      .eq('user', driverId)
  ]);

  if (activitiesError || profileError || countError) {
    console.error(activitiesError);
    console.error(profileError);
    console.error(countError);
    throw new Error(
      activitiesError?.message ||
        profileError?.message ||
        countError?.message ||
        'An error occurred'
    );
  }

  return {
    mostRecentOneHundredActivities,
    allEmployers: ['uber', 'lyft', 'doordash', 'grubhub', 'ubereats', 'postmates'], // TODO: This should be fetched from the database based on the user BUT we can't select DISTINCT
    driverProfile,
    driverLifetimeTripsCount
  };
};
