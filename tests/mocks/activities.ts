import { v7 as uuidv7 } from 'uuid';
import gigsFixture from '../fixtures/argyle/gigs-list.json' with { type: 'json' };
import type { ArgyleGigsResponse, FlattenedArgyleGig, ArgyleGig } from '@src/lib/types';

/**
 * A real gig from the Argyle sandbox (tests/fixtures/argyle, recorded by
 * `pnpm run snapshot:argyle-stub`) — the same fixtures the Playwright stub
 * replays, so both suites mock Argyle with one set of shapes.
 *
 * Only the fields a test varies are overridden below; everything else is
 * whatever Argyle actually returns. `generateMockedDriverActivityRow` and
 * `generateMockedFlattenedArgyleGig` further down stay hand-written on purpose:
 * those are our own database and internal shapes, not Argyle's.
 */
const recordedGig = (gigsFixture.body as { results: unknown[] }).results[0] as ArgyleGig;

type ArgyleDriverActivity = SupabaseRows['argyle_driver_activities'];

const generateRandomTimestampString = (): string => {
  // ISO 8601 timestamp in UTC (Coordinated Universal Time) format
  const randomDateInThePastSixMonths = new Date(
    Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 30 * 6)
  );
  return randomDateInThePastSixMonths.toISOString();
};

export const generateMockedArgyleGigsResponse = (account: string | null): ArgyleGigsResponse => ({
  results: [
    generateMockedArgyleGig(account),
    generateMockedArgyleGig(account),
    generateMockedArgyleGig(account),
    generateMockedArgyleGig(account),
    generateMockedArgyleGig(account)
  ],
  next: null,
  previous: null
});

export const generateMockedArgyleGig = (account: string | null): ArgyleGig => ({
  ...recordedGig,
  // Ids and timestamps are regenerated per gig: an id belongs to a row, not to
  // a shape, and reusing the recorded one collides on insert.
  id: uuidv7(),
  account: account ?? '00000000-0000-0000-0000-000000000000',
  created_at: generateRandomTimestampString(),
  updated_at: generateRandomTimestampString(),
  start_datetime: generateRandomTimestampString(),
  end_datetime: generateRandomTimestampString()
});

export const generateMockedDriverActivityRow = (overrideArguments = {}): ArgyleDriverActivity => ({
  account: '00000000-0000-0000-0000-000000000000',
  ride_hash: 'abcd1234',
  // NB: the account_id exists in the database table, but is *not* sent by Argyle
  account_id: '00000000-0000-0000-0000-000000000000',
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
  id: uuidv7(),
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
  metadata_circumstances_is_pool: false,
  metadata_circumstances_is_rush: null,
  metadata_circumstances_is_surge: false,
  metadata_circumstances_service_type: 'Uber',
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

export const generateMockedFlattenedArgyleGig = (overrideArguments = {}): FlattenedArgyleGig => ({
  account: '00000000-0000-0000-0000-000000000000',
  employer: Math.random() < 0.7 ? 'Uber Driver' : 'Lyft Driver', // 70% Uber, 30% Lyft
  circumstances_is_pool: false,
  circumstances_is_rush: false,
  circumstances_is_surge: false,
  circumstances_position: null,
  circumstances_service_type: 'Uber',
  created_at: generateRandomTimestampString(),
  distance: Math.floor(Math.random() * 100).toString(),
  distance_unit: 'miles',
  duration: Math.floor(Math.random() * 3600),
  earning_type: 'work',
  end_datetime: generateRandomTimestampString(),
  end_location_formatted_address: '123 Main St, Anytown, USA',
  end_location_lat: (Math.random() * 180 - 90).toFixed(6),
  end_location_lng: (Math.random() * 360 - 180).toFixed(6),
  id: uuidv7(),
  income_bonus: Math.floor(Math.random() * 100).toString(),
  income_currency: 'USD',
  income_fees: Math.floor(Math.random() * 100).toString(),
  income_other: Math.floor(Math.random() * 100).toString(),
  income_pay: Math.floor(Math.random() * 1000).toString(),
  income_rates_hour: Math.floor(Math.random() * 50).toString(),
  income_rates_mile: Math.floor(Math.random() * 10).toString(),
  income_tips: Math.floor(Math.random() * 100).toString(),
  income_total: Math.floor(Math.random() * 1000).toString(),
  income_total_charge: Math.floor(Math.random() * 1000).toString(),
  metadata_circumstances_is_pool: false,
  metadata_circumstances_is_rush: false,
  metadata_circumstances_is_surge: false,
  metadata_circumstances_service_type: 'Uber',
  metadata_origin_id: null,
  start_datetime: new Date().toISOString(),
  start_location_formatted_address: '123 Main St, Anothertown, USA',
  start_location_lat: (Math.random() * 180 - 90).toFixed(6),
  start_location_lng: (Math.random() * 360 - 180).toFixed(6),
  status: 'completed',
  task_count: Math.floor(Math.random() * 5) + 1,
  timezone: 'UTC',
  type: 'rideshare',
  updated_at: generateRandomTimestampString(),
  user: '00000000-0000-0000-0000-000000000000',
  ...overrideArguments
});
