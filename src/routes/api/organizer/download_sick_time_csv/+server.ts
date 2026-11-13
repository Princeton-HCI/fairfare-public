import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';
import {
  ANALYSIS_SCOPE_DENIED,
  canAccessAnalysisScope,
  driverBelongsToOrganization
} from '@src/routes/organizer/utils.server';
import {
  CSV_HEADERS,
  fetchBatchCSV,
  createCompressedCsvString,
  buildFilterFilename
} from '@src/lib/server/csvStreamUtils';

function buildSummaryCSV(aggData: Record<string, number>): string {
  const row = Array.isArray(aggData) ? aggData[0] : aggData;

  const startRow = 2;
  const endRow = row.trips_total + 1;
  const incomeCol = 'R';
  const durationCol = 'F';
  const startDateCol = 'D';
  const endDateCol = 'E';

  const accrualStartDate = new Date(row.accrual_start_date)
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '+00');
  const accrualEndDateTemp = new Date(row.accrual_end_date);
  accrualEndDateTemp.setDate(accrualEndDateTemp.getDate() + 1);
  const accrualEndDate = accrualEndDateTemp.toISOString().replace('T', ' ').replace('Z', '+00');

  const rateStartDate = new Date(row.rate_start_date)
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '+00');
  const rateEndDateTemp = new Date(row.rate_end_date);
  rateEndDateTemp.setDate(rateEndDateTemp.getDate() + 1);
  const rateEndDate = rateEndDateTemp.toISOString().replace('T', ' ').replace('Z', '+00');

  return [
    '',
    'Summary',
    'Description,Value,Excel Formula',
    `Total number of rides,${row.trips_total ?? 0}`,
    `Number of trips in hours accrual period,${row.trips_accrual ?? 0}`,
    `Number of trips in rate calculation period,${row.trips_rate ?? 0}`,
    `Total earned sick time hours,${row.total_earned_hours ?? 0},"=INT(SUMIFS(${durationCol + startRow}:${durationCol + endRow}, ${startDateCol + startRow}:${startDateCol + endRow}, "">=${accrualStartDate}"", ${endDateCol + startRow}:${endDateCol + endRow}, ""<${accrualEndDate}"") / 3600 / 40)"`,
    `Hourly paid sick time rate,${row.hourly_rate ?? 0},"=IFERROR(SUMIFS(${incomeCol + startRow}:${incomeCol + endRow}, ${startDateCol + startRow}:${startDateCol + endRow}, "">=${rateStartDate}"", ${endDateCol + startRow}:${endDateCol + endRow}, ""<${rateEndDate}"") / (SUMIFS(${durationCol + startRow}:${durationCol + endRow}, ${startDateCol + startRow}:${startDateCol + endRow}, "">=${rateStartDate}"", ${endDateCol + startRow}:${endDateCol + endRow}, ""<${rateEndDate}"") / 3600), 0)"`
  ].join('\n');
}

export const GET: RequestHandler = async (request) => {
  const { url } = request;
  const accrualStartDateString = url.searchParams.get('filterStartDate');
  const accrualEndDateString = url.searchParams.get('filterEndDate');
  const rateStartDateString = url.searchParams.get('rateStartDate');
  const rateEndDateString = url.searchParams.get('rateEndDate');
  const startLocation = url.searchParams.get('startLocation');
  const endLocation = url.searchParams.get('endLocation');
  const locationCombiner = url.searchParams.get('locationCombiner');
  const locationAnd = locationCombiner === 'AND';
  const platformsRaw = url.searchParams.get('platforms');
  let platforms = null;
  if (platformsRaw) platforms = platformsRaw.split(',');
  const organizationKey = url.searchParams.get('selectedScope');
  const driverUserId = url.searchParams.get('driverUserId');
  const driverName = url.searchParams.get('driverName');

  const startDateString =
    [accrualStartDateString, rateStartDateString].filter(Boolean).sort()[0] || null;

  const endDateString = [accrualEndDateString, rateEndDateString].filter(Boolean).sort()[1] || null;

  const { user, roles } = await request.locals.safeGetSession();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!organizationKey) {
    return new Response('selectedScope is required', { status: 400 });
  }

  // This CSV is for a single driver, so an org scope is required: `all` grants
  // cross-org aggregates, never a named driver.
  if (organizationKey === 'all') {
    return new Response('selectedScope must be an organization for driver exports', {
      status: 400
    });
  }

  if (!canAccessAnalysisScope(roles, organizationKey, 'export')) {
    return new Response(ANALYSIS_SCOPE_DENIED, { status: 403 });
  }

  if (!driverUserId) {
    return new Response('driverUserId is required', { status: 400 });
  }

  if (!(await driverBelongsToOrganization(supabase, driverUserId, organizationKey))) {
    return new Response('You do not have access to this driver', { status: 403 });
  }

  const driverIds: string[] | null = [driverUserId];

  // `get_sick_time_stats` is revoked from `authenticated`, so it has to run on
  // the service-role client returned by the scope check.
  const aggPromise = supabase.rpc('get_sick_time_stats', {
    in_start_date: accrualStartDateString || null,
    in_end_date: accrualEndDateString || null,
    in_start_state: startLocation || null,
    in_end_state: endLocation || null,
    in_match_all_states: locationAnd || null,
    in_employers: platforms || null,
    in_driver_id: driverUserId || null,
    in_rate_start_date: rateStartDateString || null,
    in_rate_end_date: rateEndDateString || null
  });

  const compressed = await createCompressedCsvString({
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
    prefix: driverName,
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
      'Content-Disposition': `attachment; filename="sick_time_${filters}.csv"`
    }
  });
};
