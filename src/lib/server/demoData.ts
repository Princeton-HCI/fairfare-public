import { v7 as uuidv7 } from 'uuid';
import argyleSandboxSnapshot from './demoArgyleSandboxGigs.json';

type ActivityInsert = SupabaseInserts['argyle_driver_activities'];

const SANDBOX_SOURCE_KEYS = ['test1', 'test2', 'test3'] as const;
type SandboxSourceKey = (typeof SANDBOX_SOURCE_KEYS)[number];

type SnapshotGig = (typeof argyleSandboxSnapshot.gigs)[SandboxSourceKey][number];

const MAX_DEMO_DRIVER_ACTIVITIES = 200;

export const loadDemoArgyleActivities = (
  userId: string,
  accountId: string,
  accountDbId: string | null
): Omit<ActivityInsert, 'ride_hash'>[] => {
  const sourceKey: SandboxSourceKey =
    SANDBOX_SOURCE_KEYS[Math.floor(Math.random() * SANDBOX_SOURCE_KEYS.length)];
  const sourceGigs = argyleSandboxSnapshot.gigs[sourceKey] as SnapshotGig[];

  if (!sourceGigs?.length) {
    throw new Error(
      `Demo Argyle snapshot is missing data for source "${sourceKey}". ` +
        'Re-run `pnpm snapshot:argyle-sandbox` to refresh the fixture.'
    );
  }

  const slice = sourceGigs.slice(0, MAX_DEMO_DRIVER_ACTIVITIES);

  const latestSourceTs = slice
    .map((g) => (g.start_datetime ? new Date(g.start_datetime).getTime() : null))
    .find((ts): ts is number => ts !== null);

  const offsetMs = latestSourceTs ? Date.now() - latestSourceTs : 0;
  const shift = (iso: string | null | undefined): string | null =>
    iso ? new Date(new Date(iso).getTime() + offsetMs).toISOString() : null;

  return slice.map((gig) => ({
    ...(gig as unknown as Omit<ActivityInsert, 'ride_hash'>),
    id: uuidv7(),
    user: userId,
    account: accountId,
    account_id: accountDbId,
    created_at: shift(gig.created_at) ?? new Date().toISOString(),
    updated_at: shift(gig.updated_at) ?? new Date().toISOString(),
    start_datetime: shift(gig.start_datetime),
    end_datetime: shift(gig.end_datetime)
  }));
};
