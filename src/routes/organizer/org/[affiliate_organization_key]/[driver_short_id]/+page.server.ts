import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import short from 'short-uuid';

export const load: PageServerLoad = async ({ params, locals }) => {
  const { driver_short_id: driverShortId } = params;
  const translator = short();
  const driverId = translator.toUUID(driverShortId);

  const supabase = await locals.supabase;

  const { session } = await locals.safeGetSession();

  if (session === null) {
    throw redirect(302, '/organizer/login');
  }

  // Fetch driver activities
  const { data: activities, error: activitiesError } = await supabase
    .from('argyle_driver_activities')
    .select('*')
    .eq('user', driverId);

  // Fetch driver profile
  const { data: driverProfile, error: profileError } = await supabase
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

  if (activitiesError || profileError) {
    return {
      status: 500,
      error: activitiesError?.message || profileError?.message || 'An error occurred'
    };
  }

  return {
    activities: activities,
    driverProfile: driverProfile
  };
};
