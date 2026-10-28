import type { Database } from '$lib/schema';
import type { SupabaseClient } from '@supabase/supabase-js';

type FilteredDriverActivity = {
  employer: string | null;
  status: string | null;
  timezone: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  duration: number | null;
  start_location_lat: string | null;
  start_location_lng: string | null;
  start_location_formatted_address: string | null;
  end_location_lat: string | null;
  end_location_lng: string | null;
  end_location_formatted_address: string | null;
  distance: number | null;
  distance_unit: string | null;
  circumstances_is_surge: string | null;
  income_total_charge: number | null;
  income_pay: number | null;
  income_total: number | null;
  income_bonus: number | null;
  income_tips: number | null;
  income_fees: number | null;
};

const getDriverActivities = async (
  supabase: SupabaseClient<Database>,
  driverUserId: string,
  startDateString: string | undefined,
  endDateString: string | undefined,
  selectedEmployer: string | null
): Promise<FilteredDriverActivity[]> => {
  let query = supabase
    .from('argyle_driver_activities')
    .select(
      `
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
        income_fees
      `
    )
    .eq('user', driverUserId);

  if (selectedEmployer) {
    query = query.eq('employer', selectedEmployer);
  }

  if (startDateString) {
    query = query.gte('start_datetime', startDateString);
  }

  if (endDateString) {
    query = query.lte('end_datetime', endDateString + 'T23:59:59.999Z');
  }

  query = query.order('start_datetime', { ascending: true });
  const { data: activities, error } = await query;

  if (error) {
    throw error;
  }

  return activities;
};

export default getDriverActivities;
