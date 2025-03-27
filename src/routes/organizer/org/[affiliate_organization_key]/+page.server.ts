import { redirect } from '@sveltejs/kit';
import { type ProfileWithDetails } from '../../utils';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as serverSupabase } from '@src/lib/server/db';

const getDrivers = async (
  supabase: SupabaseClient,
  currentUserId: string,
  organizationKey: string
) => {
  const { data, error } = await supabase
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
    .neq('user_id', currentUserId)
    // make sure this is for the right organization, too
    .eq(
      'driver_affiliate_organization_data_sharing_consents.affiliate_organizations.key',
      organizationKey
    )
    .returns<ProfileWithDetails[]>();

  if (error || data === null) {
    console.error(error);
    return;
  }
  // sort by most recent consent date
  data.sort((a, b) => {
    const aDate = new Date(a.driver_affiliate_organization_data_sharing_consents[0].created_at);
    const bDate = new Date(b.driver_affiliate_organization_data_sharing_consents[0].created_at);
    return bDate.getTime() - aDate.getTime();
  });

  // remove the profiles that haven't had the identities synced
  return data.filter((profile) => {
    return profile.first_name! && profile.last_name! && profile.phone!;
  });
};

export async function load({ params, locals }) {
  const supabase = await locals.supabase;
  const { session } = await locals.safeGetSession();

  if (session === null) {
    throw redirect(302, '/organizer/login');
  }

  const organizationKey = params.affiliate_organization_key;

  const { data, error } = await serverSupabase
    .from('driver_affiliate_organization_affiliations')
    .select('affiliate_organizations( key )')
    .eq('affiliate_organizations.key', organizationKey);

  if (error) {
    console.log('error', error);
    return { error };
  }
  if (!data) {
    return { error: 'No data' };
  }

  return {
    totalDriversSignedUp: data.length,
    profiles: await getDrivers(supabase, session.user.id, organizationKey)
  };
}
