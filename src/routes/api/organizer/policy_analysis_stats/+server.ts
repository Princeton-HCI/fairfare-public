import type { RequestEvent } from './$types';
import { getDriverIds } from '../policy_analysis/shared';
import { supabase } from '@src/lib/server/db';
import { ANALYSIS_SCOPE_DENIED, canAccessAnalysisScope } from '@src/routes/organizer/utils.server';
import { fetchPolicyAnalysisStats } from '@src/lib/server/policyAnalysisStats';

export type PolicyStatsResponse = {
  totalNumberOfTrips: number;
  averageDistancePerTrip: number;
  averageCustomerChargePerTrip: number;
  averageCustomerChargePerTripNoTip: number;
  averageHourlyRate: number;
  averageHourlyRateNoTip: number;
  averageDriverPayPerTrip: number;
  averageDriverPayPerTripNoTip: number;
};

export const GET = async (request: RequestEvent) => {
  const { url } = request;

  // Get the query parameters
  const startDateString =
    url.searchParams.get('filterStartDate') === '' ? null : url.searchParams.get('filterStartDate');
  const endDateString =
    url.searchParams.get('filterEndDate') === '' ? null : url.searchParams.get('filterEndDate');
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

  if (!canAccessAnalysisScope(roles, affiliateOrganizationKey)) {
    return new Response(ANALYSIS_SCOPE_DENIED, { status: 403 });
  }

  let driverIds: string[] | null = null;
  if (affiliateOrganizationKey !== 'all') {
    driverIds = await getDriverIds(supabase, affiliateOrganizationKey);
    if (driverIds.length === 0) {
      return new Response('No drivers found for this organization', { status: 404 });
    }
  }

  const stats = await fetchPolicyAnalysisStats(supabase, {
    startDate: startDateString,
    endDate: endDateString,
    startState: startLocation,
    endState: endLocation,
    matchAllStates: locationAnd,
    employers: platforms ?? null,
    driverIds
  });

  const response: PolicyStatsResponse = {
    totalNumberOfTrips: stats.total_trips ?? 0,
    averageDistancePerTrip: stats.avg_distance,
    averageCustomerChargePerTrip: stats.avg_charge,
    averageCustomerChargePerTripNoTip: stats.avg_charge_no_tip,
    averageHourlyRate: stats.avg_hourly_rate,
    averageHourlyRateNoTip: stats.avg_hourly_rate_no_tip,
    averageDriverPayPerTrip: stats.avg_pay,
    averageDriverPayPerTripNoTip: stats.avg_pay_no_tip
  };
  return new Response(JSON.stringify(response), { status: 200 });
};
