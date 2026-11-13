import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

config();

const PUB_VITE_SUPABASE_URL = process.env.PUB_VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const DEFAULT_MAX_GIGS_PER_SOURCE = 200;

const SOURCE_KEYS = ['test1', 'test2', 'test3'] as const;
type SourceKey = (typeof SOURCE_KEYS)[number];

const PHONE_BY_SOURCE: Record<SourceKey, string> = {
  test1: '18009000010',
  test2: '18009000020',
  test3: '18009000030'
};

type SnapshotGig = Omit<
  SupabaseRows['argyle_driver_activities'],
  'user' | 'account' | 'account_id' | 'id' | 'ride_hash'
>;

type SnapshotPayload = {
  capturedAt: string;
  source: {
    supabaseUrl: string;
    phoneBySource: Record<SourceKey, string>;
    rowCounts: Record<SourceKey, number>;
  };
  gigs: Record<SourceKey, SnapshotGig[]>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'lib', 'server', 'demoArgyleSandboxGigs.json');

const requireEnv = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. See data-scripts/snapshotArgyleSandboxGigs.ts header for setup.`
    );
  }
  return value;
};

const main = async () => {
  const supabaseUrl = requireEnv('PUB_VITE_SUPABASE_URL', PUB_VITE_SUPABASE_URL);
  const serviceKey = requireEnv('SUPABASE_SERVICE_KEY', SUPABASE_SERVICE_KEY);

  if (supabaseUrl.includes('supabase.co')) {
    throw new Error(
      `Refusing to snapshot from a hosted Supabase URL (${supabaseUrl}). Run this against a local supabase only.`
    );
  }

  const maxGigsRaw = process.env.ARGYLE_SANDBOX_MAX_GIGS;
  const maxGigs =
    maxGigsRaw !== undefined ? Number.parseInt(maxGigsRaw, 10) : DEFAULT_MAX_GIGS_PER_SOURCE;
  if (Number.isNaN(maxGigs) || maxGigs < 0) {
    throw new Error(
      `Invalid ARGYLE_SANDBOX_MAX_GIGS=${maxGigsRaw}; expected a non-negative integer.`
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${serviceKey}` } }
  });

  const gigs: Record<SourceKey, SnapshotGig[]> = { test1: [], test2: [], test3: [] };
  const rowCounts: Record<SourceKey, number> = { test1: 0, test2: 0, test3: 0 };

  for (const sourceKey of SOURCE_KEYS) {
    const phone = PHONE_BY_SOURCE[sourceKey];

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, phone')
      .eq('phone', phone)
      .single();

    if (profileError || !profile) {
      throw new Error(
        `Could not find profile for phone ${phone} (${sourceKey}). ` +
          'Make sure the corresponding Argyle sandbox account is connected in this local DB.'
      );
    }

    const userId = profile.user_id as string;

    const { data: activities, error: activitiesError } = await supabase
      .from('argyle_driver_activities')
      .select('*')
      .eq('user', userId)
      .order('start_datetime', { ascending: false, nullsFirst: false });

    if (activitiesError) {
      throw new Error(
        `Failed to fetch activities for ${sourceKey} (user=${userId}): ${activitiesError.message}`
      );
    }
    if (!activities || activities.length === 0) {
      throw new Error(
        `No activities found for ${sourceKey} (user=${userId}). Did the Argyle sandbox sync run?`
      );
    }

    const sampled =
      maxGigs > 0 && activities.length > maxGigs
        ? Array.from(
            { length: maxGigs },
            (_, i) => activities[Math.floor((i * activities.length) / maxGigs)]
          )
        : activities;

    const stripped = sampled.map((row) => {
      const {
        user: _user,
        account: _account,
        account_id: _accountId,
        id: _id,
        ride_hash: _rideHash,
        ...rest
      } = row as SupabaseRows['argyle_driver_activities'] & { ride_hash?: unknown };
      return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null)) as SnapshotGig;
    });

    gigs[sourceKey] = stripped;
    rowCounts[sourceKey] = stripped.length;
    console.log(
      `  ${sourceKey} (phone ${phone}): sampled ${stripped.length} of ${activities.length} activities`
    );
  }

  const payload: SnapshotPayload = {
    capturedAt: new Date().toISOString(),
    source: {
      supabaseUrl,
      phoneBySource: PHONE_BY_SOURCE,
      rowCounts
    },
    gigs
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload) + '\n', 'utf8');

  console.log(`\nWrote snapshot to ${OUTPUT_PATH}`);
  console.log(
    `Totals: test1=${rowCounts.test1}, test2=${rowCounts.test2}, test3=${rowCounts.test3}`
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
