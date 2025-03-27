type DriverActivity = SupabaseRows['argyle_driver_activities'];

const generateRandomTimestampString = (): string => {
  // ISO 8601 timestamp in UTC (Coordinated Universal Time) format
  const randomDateInThePastSixMonths = new Date(
    Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 30 * 6)
  );
  return randomDateInThePastSixMonths.toISOString();
};

export const generateMockedDriverActivity = (overrideArguments = {}): DriverActivity => ({
  account: '00000000-0000-0000-0000-000000000000',
  employer: Math.random() < 0.7 ? 'Uber Driver' : 'Lyft Driver', // 70% Uber, 30% Lyft
  circumstances_is_pool: null,
  circumstances_is_rush: null,
  circumstances_is_surge: null,
  circumstances_position: null,
  circumstances_service_type: null,
  created_at: generateRandomTimestampString(),
  distance: null,
  distance_unit: null,
  duration: null,
  earning_type: null,
  end_datetime: generateRandomTimestampString(),
  end_location: Math.floor(Math.random() * 100000),
  end_location_formatted_address: null,
  end_location_lat: (Math.random() * 180 - 90).toFixed(6),
  end_location_lng: (Math.random() * 360 - 180).toFixed(6),
  id: 'mocked_id' + Math.floor(Math.random() * 100000),
  income_bonus: Math.floor(Math.random() * 100),
  income_currency: 'USD',
  income_fees: Math.floor(Math.random() * 100),
  income_other: Math.floor(Math.random() * 100),
  income_pay: Math.floor(Math.random() * 1000),
  income_rates_hour: Math.floor(Math.random() * 50),
  income_rates_mile: Math.floor(Math.random() * 10),
  income_tips: Math.floor(Math.random() * 100),
  income_total: Math.floor(Math.random() * 1000),
  income_total_charge: Math.floor(Math.random() * 1000),
  metadata: null,
  metadata_circumstances_is_pool: null,
  metadata_circumstances_is_rush: null,
  metadata_circumstances_is_surge: null,
  metadata_circumstances_service_type: null,
  metadata_origin_id: null,
  start_datetime: new Date().toISOString(),
  start_location: Math.floor(Math.random() * 100000),
  start_location_formatted_address: null,
  start_location_lat: (Math.random() * 180 - 90).toFixed(6),
  start_location_lng: (Math.random() * 360 - 180).toFixed(6),
  status: null,
  task_count: null,
  timezone: null,
  type: null,
  updated_at: generateRandomTimestampString(),
  user: null,
  ...overrideArguments
});
