import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';
import { ANALYSIS_SCOPE_DENIED, canAccessAnalysisScope } from '@src/routes/organizer/utils.server';
import { getDriverIds } from '../policy_analysis/shared';
import {
  CSV_HEADERS,
  fetchBatchCSV,
  createCompressedCsvStream,
  buildFilterFilename
} from '@src/lib/server/csvStreamUtils';
import { fetchPolicyAnalysisStats } from '@src/lib/server/policyAnalysisStats';

function buildSummaryCSV(aggData: Record<string, number>): string {
  const row = Array.isArray(aggData) ? aggData[0] : aggData;
  return [
    '',
    'Summary',
    `Total number of trips,${row.total_trips ?? 0}`,
    `Average distance per trip,${row.avg_distance ?? 0}`,
    `Average customer charge per trip (including tips),${row.avg_charge ?? 0}`,
    `Average customer charge per trip (excluding tips),${row.avg_charge_no_tip ?? 0}`,
    `Average hourly rate (including tips),${row.avg_hourly_rate ?? 0}`,
    `Average hourly rate (excluding tips),${row.avg_hourly_rate_no_tip ?? 0}`,
    `Average driver pay per trip (including tips),${row.avg_pay ?? 0}`,
    `Average driver pay per trip (excluding tips),${row.avg_pay_no_tip ?? 0}`
  ].join('\n');
}

export const GET: RequestHandler = async (request) => {
  const { url } = request;
  const startDateString = url.searchParams.get('filterStartDate');
  const endDateString = url.searchParams.get('filterEndDate');
  const startLocation = url.searchParams.get('startLocation');
  const endLocation = url.searchParams.get('endLocation');
  const locationCombiner = url.searchParams.get('locationCombiner');
  const locationAnd = locationCombiner === 'AND';
  const platformsRaw = url.searchParams.get('platforms');
  let platforms = null;
  if (platformsRaw) platforms = platformsRaw.split(',');
  const organizationKey = url.searchParams.get('selectedScope');

  const { user, roles } = await request.locals.safeGetSession();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!organizationKey) {
    return new Response('selectedScope is required', { status: 400 });
  }

  if (!canAccessAnalysisScope(roles, organizationKey, 'export')) {
    return new Response(ANALYSIS_SCOPE_DENIED, { status: 403 });
  }

  const orgKey = organizationKey === 'all' ? null : organizationKey;

  let driverIds: string[] | null = null;
  if (orgKey) {
    driverIds = await getDriverIds(supabase, orgKey);
    if (driverIds.length === 0) {
      return new Response('No drivers found for this organization', { status: 404 });
    }
  }

  const aggPromise = fetchPolicyAnalysisStats(supabase, {
    startDate: startDateString || null,
    endDate: endDateString || null,
    startState: startLocation || null,
    endState: endLocation || null,
    matchAllStates: locationAnd,
    employers: platforms || null,
    driverIds
  }).then((data) => ({ data, error: null }));

  const compressed = createCompressedCsvStream({
    headers: CSV_HEADERS,
    fetchBatch: (cursorStartDatetime, cursorId) =>
      fetchBatchCSV(
        driverIds,
        startDateString,
        endDateString,
        startLocation,
        endLocation,
        locationAnd,
        platforms,
        cursorStartDatetime,
        cursorId
      ),
    buildSummary: buildSummaryCSV,
    aggPromise
  });

  const filters = buildFilterFilename({
    startDate: startDateString,
    endDate: endDateString,
    startLocation,
    endLocation,
    locationCombiner,
    platforms
  });

  return new Response(compressed, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Encoding': 'gzip',
      'Content-Disposition': `attachment; filename="policy_analysis_${filters}.csv"`
    }
  });
};
