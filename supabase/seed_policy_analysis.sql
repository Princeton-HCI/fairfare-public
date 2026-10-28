-- Seed script for policy analysis performance testing.
-- Generates ~6M argyle_driver_activities rows total:
--   - 50 org-affiliated drivers  x 10,000 rides = 500K rows  (queryable by organizer)
--   - 550 unaffiliated drivers   x 10,000 rides = 5.5M rows  (background noise)
--
-- Run AFTER seed.sql (which creates demo organizations):
--   psql $DATABASE_URL -f supabase/seed_policy_analysis.sql
--
-- Takes ~10-20 minutes depending on hardware.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Temporarily disable the ride_hash trigger to avoid per-row overhead on 6M inserts.
-- We compute ride_hash inline using generate_ride_hash() instead.
DROP TRIGGER IF EXISTS argyle_driver_activities_generate_hash ON argyle_driver_activities;

--------------------------------------------------------------------------------
-- 1. Create 600 test driver users in auth.users
--    First 50 are org-affiliated, remaining 550 are unaffiliated.
--    (the on_auth_user_created trigger auto-populates profiles)
--------------------------------------------------------------------------------
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'seed_driver_' || i || '@test.system.local',
  crypt('password123', gen_salt('bf')),
  NOW(),
  jsonb_build_object(
    'first_name', 'Driver' || i,
    'last_name', 'Seed' || i,
    'phone', '+1555' || LPAD(i::text, 7, '0')
  ),
  NOW() - (random() * interval '365 days'),
  NOW(),
  '',
  ''
FROM generate_series(1, 600) AS i
ON CONFLICT DO NOTHING;

-- The profiles trigger may not populate fields correctly due to column renames,
-- so backfill first_name, last_initial, and phone from raw_user_meta_data.
UPDATE profiles p
SET
  first_name = u.raw_user_meta_data ->> 'first_name',
  last_initial = LEFT(UPPER(u.raw_user_meta_data ->> 'first_name'), 1),
  phone = REGEXP_REPLACE(u.raw_user_meta_data ->> 'phone', '^\+', '')
FROM auth.users u
WHERE p.user_id = u.id
  AND u.email LIKE 'seed_driver_%@test.system.local'
  AND (p.first_name IS NULL OR p.first_name = '');

--------------------------------------------------------------------------------
-- 2. Create argyle_accounts for each test user
--------------------------------------------------------------------------------
INSERT INTO argyle_accounts (id, user_id, argyle_user, argyle_account, employer, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  gen_random_uuid(),
  gen_random_uuid(),
  CASE WHEN random() < 0.7 THEN 'Uber' ELSE 'Lyft' END,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email LIKE 'seed_driver_%@test.system.local'
ON CONFLICT DO NOTHING;

--------------------------------------------------------------------------------
-- 3. Link FIRST 50 drivers to the 'du' (LPC) org via consent
--------------------------------------------------------------------------------
INSERT INTO driver_affiliate_organization_data_sharing_consents (user_id, affiliate_organization_id, created_at)
SELECT
  u.id,
  ao.id,
  NOW() - (random() * interval '90 days')
FROM auth.users u
CROSS JOIN affiliate_organizations ao
WHERE u.email LIKE 'seed_driver_%@test.system.local'
  AND ao.key = 'du'
  -- Only first 50 drivers (seed_driver_1 through seed_driver_50)
  AND split_part(split_part(u.email, '_', 3), '@', 1)::int <= 50
ON CONFLICT DO NOTHING;

--------------------------------------------------------------------------------
-- 4. Create an organizer user for the 'du' (LPC) org so we can log in and test.
--    Phone: 12223334444, OTP: 555555, Signup code: secret
--
--    NOTE: The organizer auth user must be created via the Supabase Auth Admin
--    API (not raw SQL) because GoTrue requires internal fields that are hard
--    to replicate manually. Run this BEFORE the seed script:
--
--      curl -s -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
--        -H "Authorization: Bearer $(npx supabase status -o json 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')" \
--        -H "apikey: $(npx supabase status -o json 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')" \
--        -H 'Content-Type: application/json' \
--        -d '{"phone":"12223334444","password":"password123","phone_confirm":true}'
--
--    Or if the user already exists (e.g. from makeOrganizersSeeds), skip it.
--------------------------------------------------------------------------------

-- Give them the organizer role (skip if user doesn't exist yet)
INSERT INTO user_roles (user_id, role)
SELECT id, 'organizer'
FROM auth.users WHERE phone = '12223334444'
ON CONFLICT DO NOTHING;

-- Affiliate with 'nstlte' org
INSERT INTO organizer_affiliate_organization_affiliations (user_id, affiliate_organization_id)
SELECT u.id, ao.id
FROM auth.users u
CROSS JOIN affiliate_organizations ao
WHERE u.phone = '12223334444' AND ao.key = 'du'
ON CONFLICT DO NOTHING;

-- Whitelist the phone
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM affiliate_organizations WHERE key = 'du';
  IF v_org_id IS NOT NULL THEN
    INSERT INTO organizer_affiliations_phone_whitelist (phone_number, affiliate_organization_id)
    VALUES ('12223334444', v_org_id)
    ON CONFLICT DO NOTHING;
  ELSE
    RAISE WARNING 'du (LPC) organization not found -- skipping whitelist insert';
  END IF;
END $$;

-- Set the signup code on the org
UPDATE affiliate_organizations SET signup_code = 'secret' WHERE key = 'du';

--------------------------------------------------------------------------------
-- 5. Generate ~6M argyle_driver_activities rows
--    10,000 rides per driver x 600 drivers = 6,000,000 rows
--    ride_hash is computed inline (trigger is disabled).
--------------------------------------------------------------------------------

-- Address pools for realistic variety
DO $$
DECLARE
  v_driver RECORD;
  v_account_id uuid;
  v_batch_size int := 10000;
  v_counter int := 0;
  v_start_addresses text[] := ARRAY[
    '123 Main St, New York, NY 10001',
    '456 Oak Ave, Chicago, IL 60601',
    '789 Pine Rd, Denver, CO 80202',
    '321 Elm St, Los Angeles, CA 90001',
    '654 Maple Dr, Houston, TX 77001',
    '987 Cedar Ln, Phoenix, AZ 85001',
    '111 Broadway, New York, NY 10006',
    '222 Lake Shore Dr, Chicago, IL 60611',
    '333 Colfax Ave, Denver, CO 80204',
    '444 Sunset Blvd, Los Angeles, CA 90028',
    '555 Westheimer Rd, Houston, TX 77006',
    '666 Camelback Rd, Phoenix, AZ 85014',
    '100 Peachtree St, Atlanta, GA 30303',
    '200 Congress Ave, Austin, TX 78701',
    '300 Market St, San Francisco, CA 94105',
    '400 Biscayne Blvd, Miami, FL 33132'
  ];
  v_end_addresses text[] := ARRAY[
    '999 Broadway, New York, NY 10003',
    '888 Michigan Ave, Chicago, IL 60611',
    '777 Speer Blvd, Denver, CO 80204',
    '666 Wilshire Blvd, Los Angeles, CA 90017',
    '555 Kirby Dr, Houston, TX 77005',
    '444 Indian School Rd, Phoenix, AZ 85014',
    '333 Spring St, Atlanta, GA 30303',
    '222 S Lamar Blvd, Austin, TX 78704',
    '111 Mission St, San Francisco, CA 94105',
    '100 Ocean Dr, Miami, FL 33139'
  ];
  v_timezones text[] := ARRAY[
    'America/New_York','America/Chicago','America/Denver','America/Los_Angeles'
  ];
BEGIN
  FOR v_driver IN
    SELECT u.id AS user_id
    FROM auth.users u
    WHERE u.email LIKE 'seed_driver_%@test.system.local'
    ORDER BY u.email
  LOOP
    SELECT id INTO v_account_id
    FROM argyle_accounts
    WHERE user_id = v_driver.user_id
    LIMIT 1;

    INSERT INTO argyle_driver_activities (
      id,
      "user",
      account_id,
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
      type,
      earning_type,
      income_currency,
      ride_hash
    )
    SELECT
      v_seed_id,
      v_driver.user_id,
      v_account_id,
      CASE WHEN random() < 0.7 THEN 'Uber' ELSE 'Lyft' END,
      'completed',
      v_timezones[1 + floor(random()*4)::int],
      v_start_ts,
      v_end_ts,
      v_dur,
      v_slat,
      v_slng,
      v_start_addresses[1 + floor(random()*16)::int],
      v_elat,
      v_elng,
      v_end_addresses[1 + floor(random()*10)::int],
      v_distance,
      'miles',
      CASE WHEN random() < 0.15 THEN 'true' ELSE 'false' END,
      v_charge,
      v_pay,
      v_total,
      v_bonus,
      v_tips,
      v_fees,
      'rideshare',
      'trip',
      'USD',
      -- Use the seed ID for a guaranteed-unique hash
      digest(v_seed_id, 'sha256')
    FROM generate_series(1, v_batch_size) AS g,
    LATERAL (
      SELECT
        'seed-' || v_driver.user_id || '-' || g AS v_seed_id,
        NOW() - (random() * interval '730 days') AS v_start_ts,
        (600 + floor(random() * 4800))::int AS v_dur,
        (30 + random() * 18)::text AS v_slat,
        (-120 + random() * 50)::text AS v_slng,
        (30 + random() * 18)::text AS v_elat,
        (-120 + random() * 50)::text AS v_elng,
        round((1 + random() * 29)::numeric, 2) AS v_distance,
        round((5 + random() * 75)::numeric, 2) AS v_charge,
        round((3 + random() * 47)::numeric, 2) AS v_pay,
        round((4 + random() * 51)::numeric, 2) AS v_total,
        round((random() * 10)::numeric, 2) AS v_bonus,
        round((random() * 20)::numeric, 2) AS v_tips,
        round((1 + random() * 14)::numeric, 2) AS v_fees
    ) AS t,
    LATERAL (
      SELECT v_start_ts + make_interval(secs => v_dur) AS v_end_ts
    ) AS t2;

    v_counter := v_counter + 1;
    IF v_counter % 50 = 0 THEN
      RAISE NOTICE 'Inserted rides for % / 600 drivers', v_counter;
    END IF;

  END LOOP;

  RAISE NOTICE 'Done: inserted rides for all 600 drivers (% total rows)', v_counter * v_batch_size;
END $$;

-- Re-enable the ride_hash trigger
CREATE TRIGGER argyle_driver_activities_generate_hash
BEFORE INSERT OR UPDATE ON argyle_driver_activities
FOR EACH ROW
EXECUTE FUNCTION generate_ride_hash_on_insert();

--------------------------------------------------------------------------------
-- 6. Refresh materialized views so aggregate queries pick up the new data.
--    Only refresh if the views exist (they may not be created yet).
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'daily_driver_stats') THEN
    REFRESH MATERIALIZED VIEW daily_driver_stats;
    RAISE NOTICE 'Refreshed daily_driver_stats';
  ELSE
    RAISE NOTICE 'Skipping daily_driver_stats refresh (view does not exist)';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'organizer_daily_stats') THEN
    REFRESH MATERIALIZED VIEW organizer_daily_stats;
    RAISE NOTICE 'Refreshed organizer_daily_stats';
  ELSE
    RAISE NOTICE 'Skipping organizer_daily_stats refresh (view does not exist)';
  END IF;
END $$;

COMMIT;
