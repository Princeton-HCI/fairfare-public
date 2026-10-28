import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';
import {
  ANALYSIS_SCOPE_DENIED,
  canAccessAnalysisScope,
  driverBelongsToOrganization
} from '@src/routes/organizer/utils.server';

export type SickTimeStatsResponse = {
  tripsAccrual: number;
  tripsRate: number;
  totalEarnedSickTime: number;
  hourlyPaidSickTimeRate: number;
};

export const GET = async (request: RequestEvent) => {
  const { url } = request;

  // Get the query parameters
  const driverUserId =
    url.searchParams.get('driverUserId') === '' ? null : url.searchParams.get('driverUserId');
  const startDateString =
    url.searchParams.get('filterStartDate') === '' ? null : url.searchParams.get('filterStartDate');
  const endDateString =
    url.searchParams.get('filterEndDate') === '' ? null : url.searchParams.get('filterEndDate');
  const rateStartDateString =
    url.searchParams.get('rateStartDate') === '' ? null : url.searchParams.get('rateStartDate');
  const rateEndDateString =
    url.searchParams.get('rateEndDate') === '' ? null : url.searchParams.get('rateEndDate');
  const startLocation =
    url.searchParams.get('startLocation') === '' ? null : url.searchParams.get('startLocation');
  const endLocation =
    url.searchParams.get('endLocation') === '' ? null : url.searchParams.get('endLocation');
  const locationCombiner =
    url.searchParams.get('locationCombiner') === ''
      ? null
      : url.searchParams.get('locationCombiner');
  const locationAnd = locationCombiner === 'AND';
  const affiliateOrganizationKey = url.searchParams.get('selectedScope');
  const platforms =
    url.searchParams.get('platforms') === '' ? null : url.searchParams.get('platforms')?.split(',');

  const { user, roles } = await request.locals.safeGetSession();

  if (!user) {
    console.error('No authenticated user found.');
    return new Response('Unauthorized', { status: 401 });
  }

  if (!affiliateOrganizationKey) {
    console.error('affiliateOrganizationKey does not exist');
    return new Response('affiliateOrganizationKey is required to continue', { status: 400 });
  }

  // These are single-driver stats, so an org scope is required: `all` grants
  // cross-org aggregates, never a named driver.
  if (affiliateOrganizationKey === 'all') {
    return new Response('selectedScope must be an organization for driver stats', { status: 400 });
  }

  if (!canAccessAnalysisScope(roles, affiliateOrganizationKey)) {
    return new Response(ANALYSIS_SCOPE_DENIED, { status: 403 });
  }

  if (!driverUserId) {
    console.error('driverUserId does not exist');
    return new Response('driverUserId is required to continue', { status: 400 });
  }

  if (!(await driverBelongsToOrganization(supabase, driverUserId, affiliateOrganizationKey))) {
    return new Response('You do not have access to this driver', { status: 403 });
  }

  // Fetch stats
  const { data, error } = await supabase
    .rpc('get_sick_time_stats', {
      in_driver_id: driverUserId,
      in_start_date: startDateString,
      in_end_date: endDateString,
      in_rate_start_date: rateStartDateString,
      in_rate_end_date: rateEndDateString,
      in_start_state: startLocation,
      in_end_state: endLocation,
      in_match_all_states: locationAnd,
      in_employers: platforms
    })
    .single();

  if (error) console.error(error);

  type SickTimeStats = {
    trips_accrual: number;
    trips_rate: number;
    total_earned_hours: number;
    hourly_rate: number;
  };
  const stats = data as unknown as SickTimeStats;

  const response: SickTimeStatsResponse = {
    tripsAccrual: stats.trips_accrual ?? 0,
    tripsRate: stats.trips_rate ?? 0,
    totalEarnedSickTime: stats.total_earned_hours ?? 0,
    hourlyPaidSickTimeRate: stats.hourly_rate
  };
  return new Response(JSON.stringify(response), { status: 200 });
};
