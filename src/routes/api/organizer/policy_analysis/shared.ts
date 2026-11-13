import { type SupabaseClient } from '@supabase/supabase-js';
import type { ProfileWithDetails } from '@src/routes/organizer/utils';

export type PolicyFilteredActivitiesResponse = {
  totalNumberOfDrivers: number;
  totalNumberOfTrips: number;
  averageDistancePerTrip: number;
  averageCustomerChargePerTrip: number;
  averageCustomerChargePerTripNoTip: number;
  averageHourlyRate: number;
  averageHourlyRateNoTip: number;
  averageDriverPayPerTrip: number;
  averageDriverPayPerTripNoTip: number;
};

/**
 * Every driver who consented to share data with `organizationKey`. This is the
 * same set the RLS policies on driver rows use, so it is the right filter when
 * an endpoint queries driver rows with the service-role client. `getDriverIds`
 * below is narrower (it drops drivers with incomplete profiles) and is what the
 * stats endpoints have always used.
 */
export const getConsentingDriverIds = async (
  supabaseClient: SupabaseClient,
  organizationKey: string
): Promise<string[]> => {
  const { data, error } = await supabaseClient
    .from('driver_affiliate_organization_data_sharing_consents')
    .select('user_id, affiliate_organizations!inner(key)')
    .eq('affiliate_organizations.key', organizationKey);

  if (error || data === null) {
    console.error('Failed to load consenting drivers', error);
    return [];
  }

  return [...new Set(data.map((row) => row.user_id))];
};

export const getDriverIds = async (
  supabaseClient: SupabaseClient,
  organizationKey: string
): Promise<string[]> => {
  const { data, error } = await supabaseClient
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
    .eq(
      'driver_affiliate_organization_data_sharing_consents.affiliate_organizations.key',
      organizationKey
    )
    .overrideTypes<ProfileWithDetails[], { merge: false }>();

  if (error || data === null) {
    console.error(error);
    return [];
  }

  return data
    .filter((profile) => profile.first_name && profile.last_initial && profile.phone)
    .map((profile) => profile.user_id);
};
