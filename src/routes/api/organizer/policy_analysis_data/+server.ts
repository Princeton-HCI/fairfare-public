import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';
import { ANALYSIS_SCOPE_DENIED, canAccessAnalysisScope } from '@src/routes/organizer/utils.server';
import { getConsentingDriverIds } from '../policy_analysis/shared';

const MAX_LIMIT = 1000;

const ACTIVITY_COLUMNS = `
  employer,
  status,
  timezone,
  start_datetime,
  end_datetime,
  duration,
  start_location_lat,
  start_location_lng,
  start_location_formatted_address,
  end_location_lat,
  end_location_lng,
  end_location_formatted_address,
  distance,
  distance_unit,
  circumstances_is_surge,
  income_total_charge,
  income_pay,
  income_total,
  income_bonus,
  income_tips,
  income_fees,
  user
`;

export const GET: RequestHandler = async ({ url, locals }) => {
  // Raw per-trip rows (including the driver id) are individual workers' data, so
  // this endpoint is gated like an export, not like the aggregate stats.
  // Parse pagination params
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(
    Math.max(1, parseInt(url.searchParams.get('limit') ?? String(MAX_LIMIT), 10) || MAX_LIMIT),
    MAX_LIMIT
  );

  // Parse filter params
  const startDateString =
    url.searchParams.get('filterStartDate') === '' ? null : url.searchParams.get('filterStartDate');
  const endDateString =
    url.searchParams.get('filterEndDate') === '' ? null : url.searchParams.get('filterEndDate');
  const location =
    url.searchParams.get('location') === '' ? null : url.searchParams.get('location');
  const affiliateOrganizationKey = url.searchParams.get('selectedScope');

  const { user, roles } = await locals.safeGetSession();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!affiliateOrganizationKey) {
    return new Response('affiliateOrganizationKey is required', { status: 400 });
  }

  if (!canAccessAnalysisScope(roles, affiliateOrganizationKey, 'export')) {
    return new Response(ANALYSIS_SCOPE_DENIED, { status: 403 });
  }

  // Build query — single page, returns count on first request
  let query = supabase
    .from('argyle_driver_activities')
    .select(ACTIVITY_COLUMNS, { count: 'exact' });

  // `supabase` here is the service-role client, so RLS will not scope these
  // rows to the organization. Restrict them to its consenting drivers by hand —
  // the same consent-based set RLS applied when this ran on the user's client,
  // so drivers with incomplete profiles are not silently dropped.
  if (affiliateOrganizationKey !== 'all') {
    const driverIds = await getConsentingDriverIds(supabase, affiliateOrganizationKey);
    if (driverIds.length === 0) {
      return Response.json({ rows: [], total: 0 });
    }
    query = query.in('user', driverIds);
  }

  if (startDateString) {
    query = query.gte('start_datetime', startDateString);
  }
  if (endDateString) {
    query = query.lte('end_datetime', endDateString + 'T23:59:59.999Z');
  }
  if (location) {
    query = query.ilike('start_location_formatted_address', `%${location}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('policy_analysis_data error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return Response.json({ rows: data, total: count });
};
