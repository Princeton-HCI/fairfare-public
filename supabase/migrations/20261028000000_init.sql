

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";






CREATE TYPE "public"."affiliate_organization_status" AS ENUM (
    'active',
    'deleted'
);


ALTER TYPE "public"."affiliate_organization_status" OWNER TO "postgres";


CREATE TYPE "public"."argyle_sync_status" AS ENUM (
    'success',
    'argyle_failure',
    'deletion_blocked_by_existing_activities',
    'system_failure',
    'unknown'
);


ALTER TYPE "public"."argyle_sync_status" OWNER TO "postgres";


CREATE TYPE "public"."gig_work_is_enum" AS ENUM (
    'main_job',
    'main_job_but_has_other_jobs',
    'side_job'
);


ALTER TYPE "public"."gig_work_is_enum" OWNER TO "postgres";


CREATE TYPE "public"."hours_per_week_of_gig_work_enum" AS ENUM (
    '0-9',
    '10-19',
    '20-29',
    '30-39',
    '40-49',
    '50+'
);


ALTER TYPE "public"."hours_per_week_of_gig_work_enum" OWNER TO "postgres";


CREATE TYPE "public"."in_the_last_12_months_generic_frequency_enum" AS ENUM (
    'Not at all',
    'Rarely',
    'Sometimes',
    'Often',
    'Always'
);


ALTER TYPE "public"."in_the_last_12_months_generic_frequency_enum" OWNER TO "postgres";


CREATE TYPE "public"."in_the_last_12_months_number_of_times_enum" AS ENUM (
    '0 times',
    '1-2 times',
    '3-6 times',
    '7 or more times'
);


ALTER TYPE "public"."in_the_last_12_months_number_of_times_enum" OWNER TO "postgres";


CREATE TYPE "public"."organization_role" AS ENUM (
    'organizer',
    'lead_organizer'
);


ALTER TYPE "public"."organization_role" OWNER TO "postgres";


CREATE TYPE "public"."organizer_log_action" AS ENUM (
    'logged_in',
    'downloaded_user_data',
    'generated_user_report',
    'viewed_user_page',
    'invited_member',
    'member_joined',
    'member_role_changed',
    'member_removed',
    'removed_driver'
);


ALTER TYPE "public"."organizer_log_action" OWNER TO "postgres";


CREATE TYPE "public"."study_participations_post_sync" AS ENUM (
    'send-take-rate',
    'do-nothing',
    'send-thank-you'
);


ALTER TYPE "public"."study_participations_post_sync" OWNER TO "postgres";


CREATE TYPE "public"."study_shortcode_type" AS ENUM (
    'edl',
    'rtk'
);


ALTER TYPE "public"."study_shortcode_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'driver',
    'organizer',
    'researcher',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."organizer_membership_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_key" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "role" "public"."organization_role" NOT NULL,
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "available_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claim_token" "uuid",
    "attempts" integer DEFAULT 0 NOT NULL,
    "sent_at" timestamp with time zone,
    "abandoned_at" timestamp with time zone,
    "last_error" "text",
    CONSTRAINT "organizer_membership_alerts_source_check" CHECK (("source" = ANY (ARRAY['signup'::"text", 'team'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."organizer_membership_alerts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_organizer_membership_alerts"() RETURNS SETOF "public"."organizer_membership_alerts"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  UPDATE public.organizer_membership_alerts a
  SET claim_token = gen_random_uuid(), available_at = now() + interval '10 minutes', attempts = attempts + 1
  WHERE a.id IN (
    SELECT id FROM public.organizer_membership_alerts
    WHERE sent_at IS NULL AND abandoned_at IS NULL AND available_at <= now()
    ORDER BY available_at, id LIMIT 10 FOR UPDATE SKIP LOCKED
  ) RETURNING a.*;
$$;


ALTER FUNCTION "public"."claim_organizer_membership_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."connect_argyle_account_with_capacity"("p_user_id" "uuid", "p_argyle_user" "text", "p_argyle_account" "text", "p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_max int;
  v_count int;
  v_is_active boolean;
BEGIN
  IF p_organization_id IS NULL THEN
    -- Global / legacy path: no capacity check, just upsert.
    INSERT INTO public.argyle_accounts (
      argyle_user, argyle_account, user_id, organization_id
    )
    VALUES (p_argyle_user::uuid, p_argyle_account::uuid, p_user_id, NULL)
    ON CONFLICT (argyle_user, argyle_account, user_id)
    DO UPDATE SET organization_id = NULL;
    RETURN jsonb_build_object('over_capacity', false);
  END IF;

  -- Lock the org's config row so two parallel inserts can't both pass.
  SELECT max_argyle_accounts, is_active INTO v_max, v_is_active
  FROM public.organization_argyle_configs
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF v_is_active IS NULL OR v_is_active = false THEN
    RETURN jsonb_build_object(
      'over_capacity', true,
      'reason', 'inactive_or_missing_config'
    );
  END IF;

  IF v_max IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.argyle_accounts
    WHERE organization_id = p_organization_id AND deleted_at IS NULL;

    IF v_count >= v_max THEN
      RETURN jsonb_build_object(
        'over_capacity', true,
        'reason', 'max_argyle_accounts_reached',
        'current_count', v_count,
        'max_count', v_max
      );
    END IF;
  END IF;

  INSERT INTO public.argyle_accounts (
    argyle_user, argyle_account, user_id, organization_id
  )
  VALUES (p_argyle_user::uuid, p_argyle_account::uuid, p_user_id, p_organization_id)
  ON CONFLICT (argyle_user, argyle_account, user_id)
  DO UPDATE SET organization_id = EXCLUDED.organization_id;

  RETURN jsonb_build_object('over_capacity', false);
END $$;


ALTER FUNCTION "public"."connect_argyle_account_with_capacity"("p_user_id" "uuid", "p_argyle_user" "text", "p_argyle_account" "text", "p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ride_hash"("p_user" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_start_location_lat" "text", "p_start_location_lng" "text", "p_end_location_lat" "text", "p_end_location_lng" "text", "p_income_total" numeric) RETURNS "bytea"
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    AS $$
BEGIN
    RETURN digest(
        COALESCE(p_user::TEXT, '') || '|' ||
        COALESCE(p_start_datetime::TEXT, '') || '|' ||
        COALESCE(p_end_datetime::TEXT, '') || '|' ||
        COALESCE(p_start_location_lat, '') || '|' ||
        COALESCE(p_start_location_lng, '') || '|' ||
        COALESCE(p_end_location_lat, '') || '|' ||
        COALESCE(p_end_location_lng, '') || '|' ||
        COALESCE(p_income_total::TEXT, ''),
        'sha256'
    );
END;
$$;


ALTER FUNCTION "public"."generate_ride_hash"("p_user" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_start_location_lat" "text", "p_start_location_lng" "text", "p_end_location_lat" "text", "p_end_location_lng" "text", "p_income_total" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ride_hash_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Generate ride_hash using the function we defined above
    NEW.ride_hash = generate_ride_hash(
        NEW."user",
        NEW.start_datetime,
        NEW.end_datetime,
        NEW.start_location_lat,
        NEW.start_location_lng,
        NEW.end_location_lat,
        NEW.end_location_lng,
        NEW.income_total
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_ride_hash_on_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ride_hash_string_double_bar_concatenation"("user_id" "uuid", "start_datetime" timestamp with time zone, "end_datetime" timestamp with time zone, "start_location_lat" "text", "start_location_lng" "text", "end_location_lat" "text", "end_location_lng" "text", "income_total" numeric) RETURNS "bytea"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    RETURN digest(
        COALESCE(user_id::TEXT, '') || '|' ||
        COALESCE(start_datetime::TEXT, '') || '|' ||
        COALESCE(end_datetime::TEXT, '') || '|' ||
        COALESCE(start_location_lat, '') || '|' ||
        COALESCE(start_location_lng, '') || '|' ||
        COALESCE(end_location_lat, '') || '|' ||
        COALESCE(end_location_lng, '') || '|' ||
        COALESCE(income_total::TEXT, ''),
        'sha256'
    );
END;
$$;


ALTER FUNCTION "public"."generate_ride_hash_string_double_bar_concatenation"("user_id" "uuid", "start_datetime" timestamp with time zone, "end_datetime" timestamp with time zone, "start_location_lat" "text", "start_location_lng" "text", "end_location_lat" "text", "end_location_lng" "text", "income_total" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_policy_analysis_aggregates"("p_start_date" "text" DEFAULT NULL::"text", "p_end_date" "text" DEFAULT NULL::"text", "p_location" "text" DEFAULT NULL::"text", "p_driver_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("total_drivers" bigint, "total_trips" bigint, "avg_distance_per_trip" double precision, "avg_charge_per_trip" double precision, "avg_charge_per_trip_no_tip" double precision, "avg_hourly_rate" double precision, "avg_hourly_rate_no_tip" double precision, "avg_driver_pay_per_trip" double precision, "avg_driver_pay_per_trip_no_tip" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    COUNT(DISTINCT "user")::bigint AS total_drivers,
    COUNT(*)::bigint AS total_trips,

    -- AVG(COALESCE(x, 0)) matches JS: (sum + (val ?? 0)) / count
    AVG(COALESCE(distance, 0))::double precision
      AS avg_distance_per_trip,

    AVG(COALESCE(income_total_charge, 0))::double precision
      AS avg_charge_per_trip,

    AVG(COALESCE(income_total_charge, 0) - COALESCE(income_tips, 0))::double precision
      AS avg_charge_per_trip_no_tip,

    -- hourly rate = total_income / (total_duration_seconds / 3600)
    (SUM(COALESCE(income_total, 0))
      / NULLIF(SUM(COALESCE(duration, 0)) / 3600.0, 0))::double precision
      AS avg_hourly_rate,

    (SUM(COALESCE(income_total, 0) - COALESCE(income_tips, 0))
      / NULLIF(SUM(COALESCE(duration, 0)) / 3600.0, 0))::double precision
      AS avg_hourly_rate_no_tip,

    AVG(COALESCE(income_total, 0))::double precision
      AS avg_driver_pay_per_trip,

    AVG(COALESCE(income_total, 0) - COALESCE(income_tips, 0))::double precision
      AS avg_driver_pay_per_trip_no_tip

  FROM argyle_driver_activities
  WHERE
    (p_driver_ids IS NULL OR "user" = ANY(p_driver_ids))
    AND (p_start_date IS NULL OR start_datetime >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR end_datetime <= (p_end_date || 'T23:59:59.999Z')::timestamptz)
    AND (p_location IS NULL OR start_location_formatted_address ILIKE '%' || p_location || '%');
$$;


ALTER FUNCTION "public"."get_policy_analysis_aggregates"("p_start_date" "text", "p_end_date" "text", "p_location" "text", "p_driver_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_policy_analysis_csv_rows"("p_start_date" "text" DEFAULT NULL::"text", "p_end_date" "text" DEFAULT NULL::"text", "p_start_location" "text" DEFAULT NULL::"text", "p_end_location" "text" DEFAULT NULL::"text", "p_location_and" boolean DEFAULT true, "p_platforms" "text"[] DEFAULT NULL::"text"[], "p_driver_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_limit" integer DEFAULT 10000, "p_cursor_start_datetime" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" "text" DEFAULT NULL::"text") RETURNS TABLE("employer" "text", "status" "text", "timezone" "text", "start_datetime" timestamp with time zone, "end_datetime" timestamp with time zone, "duration" numeric, "start_location_lat" "text", "start_location_lng" "text", "start_location_formatted_address" "text", "end_location_lat" "text", "end_location_lng" "text", "end_location_formatted_address" "text", "distance" numeric, "distance_unit" "text", "circumstances_is_surge" "text", "income_total_charge" numeric, "income_pay" numeric, "income_total" numeric, "income_bonus" numeric, "income_tips" numeric, "income_fees" numeric, "id" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  _sql text;
  _state_regex text := ', ([A-Z]{2})(?:, [A-Z]{2})?$';
  last_refreshed_date date;
  last_refreshed_at_utc timestamptz;
  effective_end_date date;
BEGIN
  SELECT (last_refreshed_at AT TIME ZONE 'UTC')::date, (last_refreshed_at AT TIME ZONE 'UTC')
  INTO last_refreshed_date, last_refreshed_at_utc
  FROM policy_analysis_refresh_status
  WHERE is_singleton = true;

  IF last_refreshed_date IS NULL THEN
    RAISE EXCEPTION 'policy_analysis_refresh_status has no last_refreshed_at';
  END IF;

  IF p_end_date IS NOT NULL THEN
    effective_end_date := LEAST(p_end_date::date, last_refreshed_date);
  ELSE
    effective_end_date := last_refreshed_date;
  END IF;

  IF p_start_date IS NOT NULL AND p_start_date::date > effective_end_date THEN
    RETURN;
  END IF;

  _sql := '
    SELECT
      a.employer,
      a.status,
      a.timezone,
      a.start_datetime,
      a.end_datetime,
      a.duration,
      a.start_location_lat,
      a.start_location_lng,
      a.start_location_formatted_address,
      a.end_location_lat,
      a.end_location_lng,
      a.end_location_formatted_address,
      a.distance,
      a.distance_unit,
      a.circumstances_is_surge,
      a.income_total_charge,
      a.income_pay,
      a.income_total,
      a.income_bonus,
      a.income_tips,
      a.income_fees,
      a.id
    FROM argyle_driver_activities a
    WHERE true';

  -- Driver filter
  IF p_driver_ids IS NOT NULL THEN
    _sql := _sql || format(' AND a."user" = ANY(%L::uuid[])', p_driver_ids);
  END IF;

  -- Date range filters (avoid row-level date extraction for index usage)
  IF p_start_date IS NOT NULL THEN
    _sql := _sql || format(' AND a.start_datetime >= (%L::date AT TIME ZONE ''UTC'')', p_start_date);
  END IF;

  _sql := _sql || format(' AND a.start_datetime < ((%L::date + interval ''1 day'') AT TIME ZONE ''UTC'')', effective_end_date);

  -- Filter to only include data that existed at the time of last refresh (use actual refresh timestamp, not date boundary)
  _sql := _sql || format(' AND a.created_at::timestamptz <= %L', last_refreshed_at_utc);

  -- Location filters
  IF p_start_location IS NOT NULL OR p_end_location IS NOT NULL THEN
    IF p_location_and THEN
      IF p_start_location IS NOT NULL THEN
        _sql := _sql || format(' AND substring(a.start_location_formatted_address from %L) = %L', _state_regex, p_start_location);
      END IF;
      IF p_end_location IS NOT NULL THEN
        _sql := _sql || format(' AND substring(a.end_location_formatted_address from %L) = %L', _state_regex, p_end_location);
      END IF;
    ELSE
      _sql := _sql || ' AND (';
      IF p_start_location IS NOT NULL AND p_end_location IS NOT NULL THEN
        _sql := _sql || format('substring(a.start_location_formatted_address from %L) = %L OR substring(a.end_location_formatted_address from %L) = %L', _state_regex, p_start_location, _state_regex, p_end_location);
      ELSIF p_start_location IS NOT NULL THEN
        _sql := _sql || format('substring(a.start_location_formatted_address from %L) = %L', _state_regex, p_start_location);
      ELSE
        _sql := _sql || format('substring(a.end_location_formatted_address from %L) = %L', _state_regex, p_end_location);
      END IF;
      _sql := _sql || ')';
    END IF;
  END IF;

  -- Platform filter
  IF p_platforms IS NOT NULL THEN
    _sql := _sql || format(' AND a.employer = ANY(%L)', p_platforms);
  END IF;

  -- Cursor-based pagination using ROW() comparison for efficient index range scan
  IF p_cursor_start_datetime IS NOT NULL AND p_cursor_id IS NOT NULL THEN
    _sql := _sql || format(
      ' AND (a.start_datetime, a.id) > (%L::timestamptz, %L)',
      p_cursor_start_datetime, p_cursor_id
    );
  ELSIF p_cursor_start_datetime IS NOT NULL THEN
    _sql := _sql || format(' AND (a.start_datetime > %L::timestamptz OR a.start_datetime IS NULL)',
      p_cursor_start_datetime);
  ELSIF p_cursor_id IS NOT NULL THEN
    _sql := _sql || format(' AND a.id > %L', p_cursor_id);
  END IF;

  _sql := _sql || format(' ORDER BY a.start_datetime NULLS LAST, a.id LIMIT %s', p_limit);

  RETURN QUERY EXECUTE _sql;
END;
$_$;


ALTER FUNCTION "public"."get_policy_analysis_csv_rows"("p_start_date" "text", "p_end_date" "text", "p_start_location" "text", "p_end_location" "text", "p_location_and" boolean, "p_platforms" "text"[], "p_driver_ids" "uuid"[], "p_limit" integer, "p_cursor_start_datetime" timestamp with time zone, "p_cursor_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_policy_analysis_stats"("in_start_date" "text" DEFAULT NULL::"text", "in_end_date" "text" DEFAULT NULL::"text", "in_employers" "text"[] DEFAULT NULL::"text"[], "in_start_state" "text" DEFAULT NULL::"text", "in_end_state" "text" DEFAULT NULL::"text", "in_match_all_states" boolean DEFAULT false, "in_driver_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("total_trips" bigint, "avg_distance" numeric, "avg_charge" numeric, "avg_charge_no_tip" numeric, "avg_hourly_rate" numeric, "avg_hourly_rate_no_tip" numeric, "avg_pay" numeric, "avg_pay_no_tip" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  is_admin BOOLEAN;
  last_refreshed_date date;
  effective_start_date date;
  effective_end_date date;
BEGIN
  SELECT (last_refreshed_at AT TIME ZONE 'UTC')::date
  INTO last_refreshed_date
  FROM policy_analysis_refresh_status
  WHERE is_singleton = true;

  IF last_refreshed_date IS NULL THEN
    RAISE EXCEPTION 'policy_analysis_refresh_status has no last_refreshed_at';
  END IF;

  IF in_start_date IS NOT NULL THEN
    effective_start_date := in_start_date::date;
  END IF;

  IF in_end_date IS NOT NULL THEN
    effective_end_date := LEAST(in_end_date::date, last_refreshed_date);
  ELSE
    effective_end_date := last_refreshed_date;
  END IF;

  IF effective_start_date IS NOT NULL AND effective_start_date > effective_end_date THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  is_admin := (current_setting('role') = 'service_role');

  IF in_driver_ids IS NOT NULL OR is_admin THEN
    RETURN QUERY
    SELECT
      SUM(s.daily_trips)::BIGINT,
      COALESCE(SUM(s.sum_distance) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC,
      COALESCE(SUM(s.sum_charges) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC,
      COALESCE((SUM(s.sum_charges) - COALESCE(SUM(s.sum_tips), 0)) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC,
      COALESCE(SUM(s.sum_pay) / NULLIF(SUM(s.sum_duration) / 3600.0, 0), 0)::NUMERIC,
      COALESCE((SUM(s.sum_pay) - COALESCE(SUM(s.sum_tips), 0)) / NULLIF(SUM(s.sum_duration) / 3600.0, 0), 0)::NUMERIC,
      COALESCE(SUM(s.sum_pay) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC,
      COALESCE((SUM(s.sum_pay) - COALESCE(SUM(s.sum_tips), 0)) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC
    FROM daily_driver_stats s
    WHERE
      (in_driver_ids IS NULL OR s."user" = ANY(in_driver_ids)) AND
      (effective_start_date IS NULL OR stats_date >= effective_start_date) AND
      stats_date < (effective_end_date + INTERVAL '1 day') AND
      (in_employers IS NULL OR employer = ANY(in_employers)) AND
      (
        CASE
          WHEN in_match_all_states THEN
            (in_start_state IS NULL OR start_state = in_start_state) AND
            (in_end_state IS NULL OR end_state = in_end_state)
          ELSE
            (in_start_state IS NOT NULL AND start_state = in_start_state) OR
            (in_end_state IS NOT NULL AND end_state = in_end_state) OR
            (in_start_state IS NULL AND in_end_state IS NULL)
        END
      );
  ELSE
    RETURN QUERY
    SELECT
      SUM(s.total_trips)::BIGINT,
      COALESCE(SUM(s.total_distance) / NULLIF(SUM(s.total_trips), 0), 0)::NUMERIC,
      COALESCE(SUM(s.total_charges) / NULLIF(SUM(s.total_trips), 0), 0)::NUMERIC,
      COALESCE((SUM(s.total_charges) - COALESCE(SUM(s.total_tips), 0)) / NULLIF(SUM(s.total_trips), 0), 0)::NUMERIC,
      COALESCE(SUM(s.total_pay) / NULLIF(SUM(s.total_duration) / 3600.0, 0), 0)::NUMERIC,
      COALESCE((SUM(s.total_pay) - COALESCE(SUM(s.total_tips), 0)) / NULLIF(SUM(s.total_duration) / 3600.0, 0), 0)::NUMERIC,
      COALESCE(SUM(s.total_pay) / NULLIF(SUM(s.total_trips), 0), 0)::NUMERIC,
      COALESCE((SUM(s.total_pay) - COALESCE(SUM(s.total_tips), 0)) / NULLIF(SUM(s.total_trips), 0), 0)::NUMERIC
    FROM organizer_daily_stats s
    WHERE
      s.organizer_id = auth.uid() AND
      (effective_start_date IS NULL OR stats_date >= effective_start_date) AND
      stats_date < (effective_end_date + INTERVAL '1 day') AND
      (in_employers IS NULL OR employer = ANY(in_employers)) AND
      (
        CASE
          WHEN in_match_all_states THEN
            (in_start_state IS NULL OR start_state = in_start_state) AND
            (in_end_state IS NULL OR end_state = in_end_state)
          ELSE
            (in_start_state IS NOT NULL AND start_state = in_start_state) OR
            (in_end_state IS NOT NULL AND end_state = in_end_state) OR
            (in_start_state IS NULL AND in_end_state IS NULL)
        END
      );
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_policy_analysis_stats"("in_start_date" "text", "in_end_date" "text", "in_employers" "text"[], "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean, "in_driver_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_policy_analysis_stats_aggregate"("in_start_date" "text" DEFAULT NULL::"text", "in_end_date" "text" DEFAULT NULL::"text", "in_employers" "text" DEFAULT NULL::"text", "in_start_state" "text" DEFAULT NULL::"text", "in_end_state" "text" DEFAULT NULL::"text", "in_match_all_states" boolean DEFAULT false) RETURNS TABLE("total_trips" bigint, "avg_distance" numeric, "avg_charge" numeric, "avg_charge_no_tip" numeric, "avg_hourly_rate" numeric, "avg_hourly_rate_no_tip" numeric, "avg_pay" numeric, "avg_pay_no_tip" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  is_admin := (current_setting('role') = 'service_role');
  RETURN QUERY
  SELECT
    SUM(s.daily_trips)::BIGINT,
    COALESCE(SUM(s.sum_distance) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC,
    COALESCE(SUM(s.sum_charges) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC,
    COALESCE((SUM(s.sum_charges) - COALESCE(SUM(s.sum_tips),0)) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC,
    COALESCE(SUM(s.sum_pay) / NULLIF(SUM(s.sum_duration) / 3600.0, 0), 0)::NUMERIC,
    COALESCE((SUM(s.sum_pay) - COALESCE(SUM(s.sum_tips),0)) / NULLIF(SUM(s.sum_duration) / 3600.0, 0), 0)::NUMERIC,
    COALESCE(SUM(s.sum_pay) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC,
    COALESCE((SUM(s.sum_pay) - COALESCE(SUM(s.sum_tips),0)) / NULLIF(SUM(s.daily_trips), 0), 0)::NUMERIC
  FROM daily_driver_stats s
  WHERE
    is_admin AND
    (in_start_date IS NULL OR stats_date >= in_start_date::date) AND
    (in_end_date IS NULL OR stats_date <= in_end_date::date) AND
    (in_employers IS NULL OR employer = ANY(in_employers)) AND
    (
      CASE 
        WHEN in_match_all_states THEN 
          (in_start_state IS NULL OR start_state = in_start_state) AND 
          (in_end_state IS NULL OR end_state = in_end_state)
        ELSE 
          (in_start_state IS NOT NULL AND start_state = in_start_state) OR 
          (in_end_state IS NOT NULL AND end_state = in_end_state) OR
          (in_start_state IS NULL AND in_end_state IS NULL)
      END
    );
END;
$$;


ALTER FUNCTION "public"."get_policy_analysis_stats_aggregate"("in_start_date" "text", "in_end_date" "text", "in_employers" "text", "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_policy_analysis_stats_batch"("in_start_date" "text" DEFAULT NULL::"text", "in_end_date" "text" DEFAULT NULL::"text", "in_employers" "text"[] DEFAULT NULL::"text"[], "in_start_state" "text" DEFAULT NULL::"text", "in_end_state" "text" DEFAULT NULL::"text", "in_match_all_states" boolean DEFAULT false, "in_driver_ids" "uuid"[] DEFAULT NULL::"uuid"[], "in_cursor_start_datetime" timestamp with time zone DEFAULT NULL::timestamp with time zone, "in_cursor_id" "text" DEFAULT NULL::"text", "in_batch_size" integer DEFAULT 10000) RETURNS TABLE("batch_trips" bigint, "sum_distance" numeric, "sum_charges" numeric, "sum_pay" numeric, "sum_tips" numeric, "sum_duration" numeric, "next_cursor_start_datetime" timestamp with time zone, "next_cursor_id" "text", "has_more" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
	is_admin boolean;
	caller_user_id uuid := auth.uid();
	consented_user_ids uuid[];
	effective_start_date date;
	effective_end_date date;
	-- Default to larger batches for fewer round trips while keeping timeout fallback logic in app code.
	requested_batch_size integer := LEAST(GREATEST(COALESCE(in_batch_size, 5000), 100), 5000);
BEGIN
	IF in_start_date IS NOT NULL THEN
		effective_start_date := in_start_date::date;
	END IF;

	IF in_end_date IS NOT NULL THEN
		effective_end_date := in_end_date::date;
	END IF;

	IF effective_start_date IS NOT NULL
	   AND effective_end_date IS NOT NULL
	   AND effective_start_date > effective_end_date THEN
		RETURN QUERY
		SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, NULL::timestamptz, NULL::text, false;
		RETURN;
	END IF;

	is_admin := current_setting('role', true) = 'service_role';

	IF in_driver_ids IS NULL AND NOT is_admin AND caller_user_id IS NULL THEN
		RETURN QUERY
		SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, NULL::timestamptz, NULL::text, false;
		RETURN;
	END IF;

	IF (in_cursor_start_datetime IS NULL) <> (in_cursor_id IS NULL) THEN
		RAISE EXCEPTION 'in_cursor_start_datetime and in_cursor_id must both be NULL or both be provided';
	END IF;

	IF in_driver_ids IS NOT NULL THEN
		-- Explicit driver list: unambiguous user filter lets planner use ("user", start_datetime, id) index.
		RETURN QUERY
		WITH raw_batch AS (
			SELECT
				a.start_datetime,
				a.id,
				a.distance,
				a.income_total_charge,
				a.income_total,
				a.income_tips,
				a.duration
			FROM argyle_driver_activities a
			WHERE
				a."user" = ANY(in_driver_ids) AND
				(effective_start_date IS NULL OR a.start_datetime >= (effective_start_date::timestamp AT TIME ZONE 'UTC')) AND
				(effective_end_date IS NULL OR a.start_datetime < ((effective_end_date + INTERVAL '1 day') AT TIME ZONE 'UTC')) AND
				(in_employers IS NULL OR a.employer = ANY(in_employers)) AND
				(
					CASE
						WHEN in_match_all_states THEN
							(in_start_state IS NULL OR substring(a.start_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_start_state) AND
							(in_end_state IS NULL OR substring(a.end_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_end_state)
						ELSE
							(in_start_state IS NOT NULL AND substring(a.start_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_start_state) OR
							(in_end_state IS NOT NULL AND substring(a.end_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_end_state) OR
							(in_start_state IS NULL AND in_end_state IS NULL)
					END
				) AND
				(in_cursor_start_datetime IS NULL OR (a.start_datetime, a.id) > (in_cursor_start_datetime, in_cursor_id))
			ORDER BY a.start_datetime NULLS LAST, a.id
			LIMIT (requested_batch_size + 1)
		),
		ordered_batch AS (
			SELECT *
			FROM raw_batch
			ORDER BY start_datetime NULLS LAST, id
			LIMIT requested_batch_size
		),
		batch_totals AS (
			SELECT
				COUNT(*)::bigint AS trip_count,
				COALESCE(SUM(distance), 0)::numeric AS total_distance,
				COALESCE(SUM(income_total_charge), 0)::numeric AS total_charges,
				COALESCE(SUM(income_total), 0)::numeric AS total_pay,
				COALESCE(SUM(income_tips), 0)::numeric AS total_tips,
				COALESCE(SUM(duration), 0)::numeric AS total_duration
			FROM ordered_batch
		),
		batch_tail AS (
			SELECT start_datetime, id
			FROM ordered_batch
			ORDER BY start_datetime DESC NULLS LAST, id DESC
			LIMIT 1
		),
		batch_size_info AS (
			SELECT COUNT(*)::integer AS raw_count
			FROM raw_batch
		)
		SELECT
			batch_totals.trip_count,
			batch_totals.total_distance,
			batch_totals.total_charges,
			batch_totals.total_pay,
			batch_totals.total_tips,
			batch_totals.total_duration,
			batch_tail.start_datetime,
			batch_tail.id,
			batch_size_info.raw_count > requested_batch_size
		FROM batch_totals
		CROSS JOIN batch_size_info
		LEFT JOIN batch_tail ON true;
	ELSIF is_admin THEN
		-- Admin full scan: no user filter, planner uses (start_datetime, id) index cleanly.
		RETURN QUERY
		WITH raw_batch AS (
			SELECT
				a.start_datetime,
				a.id,
				a.distance,
				a.income_total_charge,
				a.income_total,
				a.income_tips,
				a.duration
			FROM argyle_driver_activities a
			WHERE
				(effective_start_date IS NULL OR a.start_datetime >= (effective_start_date::timestamp AT TIME ZONE 'UTC')) AND
				(effective_end_date IS NULL OR a.start_datetime < ((effective_end_date + INTERVAL '1 day') AT TIME ZONE 'UTC')) AND
				(in_employers IS NULL OR a.employer = ANY(in_employers)) AND
				(
					CASE
						WHEN in_match_all_states THEN
							(in_start_state IS NULL OR substring(a.start_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_start_state) AND
							(in_end_state IS NULL OR substring(a.end_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_end_state)
						ELSE
							(in_start_state IS NOT NULL AND substring(a.start_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_start_state) OR
							(in_end_state IS NOT NULL AND substring(a.end_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_end_state) OR
							(in_start_state IS NULL AND in_end_state IS NULL)
					END
				) AND
				(in_cursor_start_datetime IS NULL OR (a.start_datetime, a.id) > (in_cursor_start_datetime, in_cursor_id))
			ORDER BY a.start_datetime NULLS LAST, a.id
			LIMIT (requested_batch_size + 1)
		),
		ordered_batch AS (
			SELECT *
			FROM raw_batch
			ORDER BY start_datetime NULLS LAST, id
			LIMIT requested_batch_size
		),
		batch_totals AS (
			SELECT
				COUNT(*)::bigint AS trip_count,
				COALESCE(SUM(distance), 0)::numeric AS total_distance,
				COALESCE(SUM(income_total_charge), 0)::numeric AS total_charges,
				COALESCE(SUM(income_total), 0)::numeric AS total_pay,
				COALESCE(SUM(income_tips), 0)::numeric AS total_tips,
				COALESCE(SUM(duration), 0)::numeric AS total_duration
			FROM ordered_batch
		),
		batch_tail AS (
			SELECT start_datetime, id
			FROM ordered_batch
			ORDER BY start_datetime DESC NULLS LAST, id DESC
			LIMIT 1
		),
		batch_size_info AS (
			SELECT COUNT(*)::integer AS raw_count
			FROM raw_batch
		)
		SELECT
			batch_totals.trip_count,
			batch_totals.total_distance,
			batch_totals.total_charges,
			batch_totals.total_pay,
			batch_totals.total_tips,
			batch_totals.total_duration,
			batch_tail.start_datetime,
			batch_tail.id,
			batch_size_info.raw_count > requested_batch_size
		FROM batch_totals
		CROSS JOIN batch_size_info
		LEFT JOIN batch_tail ON true;
	ELSE
		SELECT COALESCE(array_agg(DISTINCT dcons.user_id), ARRAY[]::uuid[])
		INTO consented_user_ids
		FROM driver_affiliate_organization_data_sharing_consents dcons
		JOIN organizer_affiliate_organization_affiliations oaff
			ON oaff.affiliate_organization_id = dcons.affiliate_organization_id
		JOIN user_roles ur
			ON ur.user_id = oaff.user_id
		 AND ur.role = 'organizer'
		WHERE oaff.user_id = caller_user_id;

		IF COALESCE(array_length(consented_user_ids, 1), 0) = 0 THEN
			RETURN QUERY
			SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, NULL::timestamptz, NULL::text, false;
			RETURN;
		END IF;

		RETURN QUERY
		-- Org scope uses key-first pagination, then fetches full rows by id for the selected page.
		WITH candidate_keys AS (
			SELECT
				a.start_datetime,
				a.id
			FROM argyle_driver_activities a
			WHERE
				(effective_start_date IS NULL OR a.start_datetime >= (effective_start_date::timestamp AT TIME ZONE 'UTC')) AND
				(effective_end_date IS NULL OR a.start_datetime < ((effective_end_date + INTERVAL '1 day') AT TIME ZONE 'UTC')) AND
				(in_employers IS NULL OR a.employer = ANY(in_employers)) AND
				(
					CASE
						WHEN in_match_all_states THEN
							(in_start_state IS NULL OR substring(a.start_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_start_state) AND
							(in_end_state IS NULL OR substring(a.end_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_end_state)
						ELSE
							(in_start_state IS NOT NULL AND substring(a.start_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_start_state) OR
							(in_end_state IS NOT NULL AND substring(a.end_location_formatted_address from ', ([A-Z]{2})(?:, [A-Z]{2})?$') = in_end_state) OR
							(in_start_state IS NULL AND in_end_state IS NULL)
					END
				) AND
				a."user" = ANY(consented_user_ids) AND
				(in_cursor_start_datetime IS NULL OR (a.start_datetime, a.id) > (in_cursor_start_datetime, in_cursor_id))
			ORDER BY a.start_datetime NULLS LAST, a.id
			LIMIT (requested_batch_size + 1)
		),
		ordered_keys AS (
			SELECT *
			FROM candidate_keys
			ORDER BY start_datetime NULLS LAST, id
			LIMIT requested_batch_size
		),
		raw_batch AS (
			SELECT
				a.start_datetime,
				a.id,
				a.distance,
				a.income_total_charge,
				a.income_total,
				a.income_tips,
				a.duration
			FROM argyle_driver_activities a
			JOIN ordered_keys ok
				ON ok.id = a.id
		),
		batch_totals AS (
			SELECT
				COUNT(*)::bigint AS trip_count,
				COALESCE(SUM(distance), 0)::numeric AS total_distance,
				COALESCE(SUM(income_total_charge), 0)::numeric AS total_charges,
				COALESCE(SUM(income_total), 0)::numeric AS total_pay,
				COALESCE(SUM(income_tips), 0)::numeric AS total_tips,
				COALESCE(SUM(duration), 0)::numeric AS total_duration
			FROM raw_batch
		),
		batch_tail AS (
			SELECT start_datetime, id
			FROM ordered_keys
			ORDER BY start_datetime DESC NULLS LAST, id DESC
			LIMIT 1
		),
		batch_size_info AS (
			SELECT COUNT(*)::integer AS raw_count
			FROM candidate_keys
		)
		SELECT
			batch_totals.trip_count,
			batch_totals.total_distance,
			batch_totals.total_charges,
			batch_totals.total_pay,
			batch_totals.total_tips,
			batch_totals.total_duration,
			batch_tail.start_datetime,
			batch_tail.id,
			batch_size_info.raw_count > requested_batch_size
		FROM batch_totals
		CROSS JOIN batch_size_info
		LEFT JOIN batch_tail ON true;
	END IF;
END;
$_$;


ALTER FUNCTION "public"."get_policy_analysis_stats_batch"("in_start_date" "text", "in_end_date" "text", "in_employers" "text"[], "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean, "in_driver_ids" "uuid"[], "in_cursor_start_datetime" timestamp with time zone, "in_cursor_id" "text", "in_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sick_time_stats"("in_driver_id" "uuid" DEFAULT NULL::"uuid", "in_start_date" "text" DEFAULT NULL::"text", "in_end_date" "text" DEFAULT NULL::"text", "in_rate_start_date" "text" DEFAULT NULL::"text", "in_rate_end_date" "text" DEFAULT NULL::"text", "in_employers" "text"[] DEFAULT NULL::"text"[], "in_start_state" "text" DEFAULT NULL::"text", "in_end_state" "text" DEFAULT NULL::"text", "in_match_all_states" boolean DEFAULT false) RETURNS TABLE("trips_accrual" bigint, "trips_rate" bigint, "trips_total" bigint, "total_earned_hours" numeric, "hourly_rate" numeric, "accrual_start_date" "text", "accrual_end_date" "text", "rate_start_date" "text", "rate_end_date" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH filtered_base AS (
    SELECT 
      stats_date,
      sum_duration,
      sum_pay,
      daily_trips
    FROM daily_driver_stats
    WHERE 
      "user" = in_driver_id AND
      (
      CASE 
        WHEN in_match_all_states THEN 
          (in_start_state IS NULL OR start_state = in_start_state) AND 
          (in_end_state IS NULL OR end_state = in_end_state)
        ELSE 
          (in_start_state IS NOT NULL AND start_state = in_start_state) OR 
          (in_end_state IS NOT NULL AND end_state = in_end_state) OR
          (in_start_state IS NULL AND in_end_state IS NULL)
      END
      )
      AND (in_employers IS NULL OR employer = ANY(in_employers))
  ),
  range_calc AS (
    SELECT 
      COALESCE(FLOOR(SUM(sum_duration) / 3600.0 / 40.0), 0)::NUMERIC as total_hours, 
      COALESCE(SUM(daily_trips), 0)::bigint as trips
    FROM filtered_base
    WHERE (in_start_date IS NULL OR stats_date >= in_start_date::date) AND (in_end_date IS NULL OR stats_date <= in_end_date::date)
  ),
  year_calc AS (
    SELECT 
      COALESCE(
        SUM(sum_pay) / NULLIF(SUM(sum_duration) / 3600.0, 0), 
        0
      )::NUMERIC as rate, 
      COALESCE(SUM(daily_trips), 0)::bigint as trips
    FROM filtered_base
    WHERE (in_rate_start_date IS NULL OR stats_date >= in_rate_start_date::date) AND (in_rate_end_date IS NULL OR stats_date <= in_rate_end_date::date)
  ),
  total_calc AS (
    SELECT COALESCE(SUM(daily_trips), 0)::bigint as trips
    FROM filtered_base
    WHERE (stats_date >= LEAST(in_start_date::date, in_rate_start_date::date)) AND (stats_date <= GREATEST(in_end_date::date, in_rate_end_date::date))
  )
  SELECT r.trips, y.trips, t.trips, r.total_hours, y.rate, in_start_date, in_end_date, in_rate_start_date, in_rate_end_date
  FROM range_calc r, year_calc y, total_calc t;
END;
$$;


ALTER FUNCTION "public"."get_sick_time_stats"("in_driver_id" "uuid", "in_start_date" "text", "in_end_date" "text", "in_rate_start_date" "text", "in_rate_end_date" "text", "in_employers" "text"[], "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_last_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.role <> 'admin' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = 'admin' THEN RETURN NEW; END IF;

  -- Deleting the auth user cascades to this row. Do not block account deletion
  -- on the invariant (the same carve-out guard_organization_membership makes),
  -- or the sole admin's account could not be deleted at all.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- One advisory lock serializes every admin revocation: two admins demoting
  -- each other at once would otherwise each see the other and both succeed.
  -- The loser blocks here, and re-reads after the winner commits (READ
  -- COMMITTED gives each statement in this function a fresh snapshot), at which
  -- point the row it was counting on is no longer an admin.
  --
  -- `SELECT ... FOR UPDATE` on the remaining admin rows cannot do this job: the
  -- UPDATE/DELETE has already locked the row this trigger fires for, so two
  -- concurrent revocations each wait on the other's row and Postgres kills one
  -- with a deadlock (40P01) instead of the P0001 the handler turns into a 409.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.guard_last_admin')::bigint);

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin' AND user_id <> OLD.user_id
  ) THEN
    RAISE EXCEPTION 'cannot remove the last platform admin; grant another admin first'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."guard_last_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_organization_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND
     (NEW.user_id <> OLD.user_id OR NEW.organization_id <> OLD.organization_id) THEN
    RAISE EXCEPTION 'membership identity cannot be changed' USING ERRCODE = '22023';
  END IF;
  v_org := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  PERFORM id FROM public.affiliate_organizations WHERE id = v_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    -- An organization deletion cascades through its memberships.
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' AND OLD.role = 'lead_organizer' AND
     (TG_OP = 'DELETE' OR NEW.role <> 'lead_organizer') AND
     -- Admin and service-role writes are exempt; see membership_guard_bypassed.
     NOT public.membership_guard_bypassed() AND
     -- A cascade from deleting the auth user has already removed the user row;
     -- do not block account deletion on the last-lead invariant. Without this,
     -- the sole lead of an organization could not be deleted at all and both
     -- driver opt-out and admin "delete driver" returned 500.
     EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) AND
     NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND role = 'researcher') AND
     NOT EXISTS (
       SELECT 1 FROM public.organization_members m
       WHERE m.organization_id = v_org AND m.user_id <> OLD.user_id AND m.role = 'lead_organizer'
         AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = m.user_id AND ur.role = 'researcher')
     ) THEN
    RAISE EXCEPTION 'cannot remove the last lead organizer' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Removing membership must also revoke the login grant, in this transaction.
    DELETE FROM public.organizer_affiliations_phone_whitelist w
    WHERE w.affiliate_organization_id = v_org AND w.phone_number IN (
      SELECT phone FROM auth.users WHERE id = OLD.user_id
      UNION SELECT phone FROM public.profiles WHERE user_id = OLD.user_id
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_organization_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_researcher_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_org uuid;
BEGIN
  IF NEW.role <> 'researcher' THEN RETURN NEW; END IF;
  -- Writes to user_roles are an admin operation today, so this is the same
  -- exemption the membership trigger makes rather than a separate policy.
  IF public.membership_guard_bypassed() THEN RETURN NEW; END IF;
  -- BEFORE INSERT also runs for ON CONFLICT updates; allow idempotent assignment.
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'researcher') THEN
    RETURN NEW;
  END IF;
  FOR v_org IN
    SELECT o.id FROM public.affiliate_organizations o
    JOIN public.organization_members m ON m.organization_id = o.id
    WHERE m.user_id = NEW.user_id AND m.role = 'lead_organizer'
    ORDER BY o.id FOR NO KEY UPDATE OF o
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = v_org AND m.user_id <> NEW.user_id AND m.role = 'lead_organizer'
        AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = m.user_id AND ur.role = 'researcher')
    ) THEN
      RAISE EXCEPTION 'cannot remove the last lead organizer; assign another lead before making this user a researcher'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_researcher_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_user_last_sign_in_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    -- Update the last_sign_in_at field in the profiles table
    update public.profiles
    set last_sign_in_at = now()
    where user_id = new.id;

    return new;
exception when others then
    -- If an error occurs, log it and return the new row
    raise notice 'Error updating last_sign_in_at for user_id %: %', new.id, sqlerrm;
    return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_user_last_sign_in_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_org_role"("p_org_id" "uuid", "p_min" "public"."organization_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT NOT public.has_platform_role('researcher') AND (
    public.has_platform_role('admin') OR EXISTS (
      SELECT 1 FROM public.organization_members m
      JOIN public.affiliate_organizations o ON o.id = m.organization_id
      WHERE m.user_id = (SELECT auth.uid()) AND m.organization_id = p_org_id
        AND o.status = 'active'
        AND public.organization_role_rank(m.role) >= public.organization_role_rank(p_min)
    )
  );
$$;


ALTER FUNCTION "public"."has_org_role"("p_org_id" "uuid", "p_min" "public"."organization_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_platform_role"("p_role" "public"."user_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role = p_role
  );
$$;


ALTER FUNCTION "public"."has_platform_role"("p_role" "public"."user_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_organization_member"("p_organization_id" "uuid", "p_phone" "text", "p_role" "public"."organization_role" DEFAULT 'organizer'::"public"."organization_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_user_id uuid;
  v_current public.organization_role;
  v_lead_count integer;
BEGIN
  PERFORM id FROM public.affiliate_organizations
  WHERE id = p_organization_id FOR NO KEY UPDATE;
  IF NOT (
    public.has_org_role(p_organization_id, 'lead_organizer')
    OR public.has_platform_role('admin')
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_phone IS NULL OR p_phone !~ '^\d+$' THEN
    RAISE EXCEPTION 'invalid phone' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.organizer_affiliations_phone_whitelist (
    phone_number,
    affiliate_organization_id,
    invited_role
  )
  VALUES (p_phone, p_organization_id, p_role)
  ON CONFLICT (affiliate_organization_id, phone_number) DO UPDATE
    SET invited_role = EXCLUDED.invited_role;

  SELECT id INTO v_user_id FROM auth.users WHERE phone = p_phone LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM public.profiles WHERE phone = p_phone LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    -- Re-inviting an existing member also changes their role, so it has to
    -- honour the same last-lead guard as set_organization_member_role —
    -- otherwise the sole lead can demote themselves and lock the org out of
    -- team and settings management. Platform admins are exempt, as everywhere
    -- else the invariant is enforced.
    SELECT role INTO v_current
    FROM public.organization_members
    WHERE user_id = v_user_id AND organization_id = p_organization_id;

    IF v_current = 'lead_organizer' AND p_role <> 'lead_organizer'
       AND NOT public.membership_guard_bypassed() THEN
      SELECT COUNT(*) INTO v_lead_count
      FROM public.organization_members
      WHERE organization_id = p_organization_id AND role = 'lead_organizer';
      IF v_lead_count <= 1 THEN
        RAISE EXCEPTION 'cannot remove the last lead organizer' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    INSERT INTO public.organization_members (user_id, organization_id, role, created_by)
    VALUES (v_user_id, p_organization_id, p_role, (SELECT auth.uid()))
    ON CONFLICT (user_id, organization_id) DO UPDATE
      SET role = EXCLUDED.role;
  END IF;
END;
$_$;


ALTER FUNCTION "public"."invite_organization_member"("p_organization_id" "uuid", "p_phone" "text", "p_role" "public"."organization_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_organization_from_invite"("p_user_id" "uuid", "p_organization_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_role public.organization_role;
BEGIN
  PERFORM id FROM public.affiliate_organizations WHERE id = p_organization_id FOR NO KEY UPDATE;
  SELECT w.invited_role INTO v_role
  FROM public.organizer_affiliations_phone_whitelist w
  WHERE w.affiliate_organization_id = p_organization_id AND w.phone_number IN (
    SELECT phone FROM auth.users WHERE id = p_user_id
    UNION SELECT phone FROM public.profiles WHERE user_id = p_user_id
  ) LIMIT 1;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'organization invite was revoked' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.organization_members(user_id, organization_id, role)
  VALUES (p_user_id, p_organization_id, v_role)
  ON CONFLICT (user_id, organization_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."join_organization_from_invite"("p_user_id" "uuid", "p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."membership_guard_bypassed"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT current_setting('role', true) = 'service_role'
    -- PostgREST exposes the caller's role on the GUC above; the JWT claim is the
    -- fallback for a connection that was not switched with SET ROLE.
    OR coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
         ''
       ) = 'service_role'
    OR public.has_platform_role('admin');
$$;


ALTER FUNCTION "public"."membership_guard_bypassed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organization_role_rank"("p_role" "public"."organization_role") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE p_role
    WHEN 'organizer'::public.organization_role THEN 1
    WHEN 'lead_organizer'::public.organization_role THEN 2
  END;
$$;


ALTER FUNCTION "public"."organization_role_rank"("p_role" "public"."organization_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organizer_affiliations_view_instead_of_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.organization_members
  WHERE user_id = OLD.user_id
    AND organization_id = OLD.affiliate_organization_id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."organizer_affiliations_view_instead_of_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organizer_affiliations_view_instead_of_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.organization_members (user_id, organization_id, role, created_at)
  VALUES (
    NEW.user_id,
    NEW.affiliate_organization_id,
    'organizer',
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."organizer_affiliations_view_instead_of_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_profiles_from_user_table"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    email,
    phone
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."populate_profiles_from_user_table"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_organization_membership_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_phone text; v_email text; v_key text; v_source text;
BEGIN
  SELECT phone, email INTO v_phone, v_email FROM auth.users WHERE id = NEW.user_id;
  -- Demo accounts are intentionally ephemeral and must not notify operators.
  IF v_email LIKE '%@demo.system.local' THEN RETURN NEW; END IF;
  IF v_phone IS NULL OR v_phone = '' THEN
    SELECT phone INTO v_phone FROM public.profiles WHERE user_id = NEW.user_id;
  END IF;
  SELECT key INTO v_key FROM public.affiliate_organizations WHERE id = NEW.organization_id;
  v_source := CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = coalesce(auth.uid(), NEW.created_by) AND role = 'admin') THEN 'admin'
    WHEN auth.uid() IS NOT NULL OR NEW.created_by IS NOT NULL THEN 'team'
    ELSE 'signup' END;
  INSERT INTO public.organizer_membership_alerts(user_id, organization_key, phone, role, source)
  VALUES (NEW.user_id, v_key, coalesce(v_phone, ''), NEW.role, v_source);
  INSERT INTO public.organizer_logging(id, user_id, action, additional_data)
  VALUES (gen_random_uuid(), NEW.user_id, 'member_joined',
    jsonb_build_object('organizationKey', v_key, 'role', NEW.role, 'source', v_source,
      'actorUserId', coalesce(auth.uid(), NEW.created_by)));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."record_organization_membership_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_policy_analysis_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Record the snapshot timestamp BEFORE the refresh so the boundary aligns
  -- with the data snapshot taken by REFRESH MATERIALIZED VIEW CONCURRENTLY.
  INSERT INTO policy_analysis_refresh_status (is_singleton, last_refreshed_at)
  VALUES (true, now() AT TIME ZONE 'UTC')
  ON CONFLICT (is_singleton) DO UPDATE SET last_refreshed_at = EXCLUDED.last_refreshed_at;

  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_driver_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY organizer_daily_stats;
END;
$$;


ALTER FUNCTION "public"."refresh_policy_analysis_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_organization_member"("p_organization_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM id FROM public.affiliate_organizations
  WHERE id = p_organization_id FOR NO KEY UPDATE;
  IF NOT public.has_org_role(p_organization_id, 'lead_organizer') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  -- The table trigger enforces last-lead protection and revokes login grants.
  DELETE FROM public.organization_members
  WHERE user_id = p_user_id AND organization_id = p_organization_id;
  -- Also revoke grants left behind by an earlier, already-completed deletion.
  DELETE FROM public.organizer_affiliations_phone_whitelist w
  WHERE w.affiliate_organization_id = p_organization_id AND w.phone_number IN (
    SELECT phone FROM auth.users WHERE id = p_user_id
    UNION SELECT phone FROM public.profiles WHERE user_id = p_user_id
  );
END;
$$;


ALTER FUNCTION "public"."remove_organization_member"("p_organization_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_organization_invite"("p_organization_id" "uuid", "p_phone" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM id FROM public.affiliate_organizations
  WHERE id = p_organization_id FOR NO KEY UPDATE;
  IF NOT (
    public.has_org_role(p_organization_id, 'lead_organizer')
    OR public.has_platform_role('admin')
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.organizer_affiliations_phone_whitelist
  WHERE affiliate_organization_id = p_organization_id
    AND phone_number = p_phone;
END;
$$;


ALTER FUNCTION "public"."revoke_organization_invite"("p_organization_id" "uuid", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_member_role"("p_organization_id" "uuid", "p_user_id" "uuid", "p_role" "public"."organization_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_current public.organization_role;
  v_lead_count integer;
BEGIN
  PERFORM id FROM public.affiliate_organizations
  WHERE id = p_organization_id FOR NO KEY UPDATE;
  IF NOT (
    public.has_org_role(p_organization_id, 'lead_organizer')
    OR public.has_platform_role('admin')
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_current
  FROM public.organization_members
  WHERE user_id = p_user_id AND organization_id = p_organization_id;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'member not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_current = 'lead_organizer' AND p_role <> 'lead_organizer'
     AND NOT public.membership_guard_bypassed() THEN
    SELECT COUNT(*) INTO v_lead_count
    FROM public.organization_members
    WHERE organization_id = p_organization_id AND role = 'lead_organizer';
    IF v_lead_count <= 1 THEN
      RAISE EXCEPTION 'cannot remove the last lead organizer' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.organization_members
  SET role = p_role
  WHERE user_id = p_user_id AND organization_id = p_organization_id;
END;
$$;


ALTER FUNCTION "public"."set_organization_member_role"("p_organization_id" "uuid", "p_user_id" "uuid", "p_role" "public"."organization_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stop_sharing_primary"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.driver_affiliate_organization_data_sharing_consents
  WHERE user_id = p_user_id;

  DELETE FROM public.driver_affiliate_organization_affiliations
  WHERE user_id = p_user_id;

  UPDATE public.argyle_accounts
  SET deleted_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id AND deleted_at IS NULL;
END $$;


ALTER FUNCTION "public"."stop_sharing_primary"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_auth_users_on_public_profile_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Update the corresponding row in auth.users when a profile is updated
    UPDATE auth.users
    SET
        email = NEW.email,
        phone = NEW.phone
    WHERE
        id = NEW.user_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_auth_users_on_public_profile_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "admin_email" "text",
    "action" "text" NOT NULL,
    "target_type" "text",
    "target_id" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_data_downloads_by_organizers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "downloading_user_id" "uuid" NOT NULL,
    "downloaded_user_data_id" "uuid" NOT NULL,
    "includes_pdf" boolean NOT NULL,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "selected_employer" "text",
    "affiliate_organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."driver_data_downloads_by_organizers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_logging" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action" "public"."organizer_log_action" NOT NULL,
    "additional_data" "jsonb"
);


ALTER TABLE "public"."organizer_logging" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_audit_events" WITH ("security_invoker"='false') AS
 SELECT "e"."id",
    "e"."source",
    "e"."at",
    "e"."actor_id",
    COALESCE("e"."actor_email", (( SELECT "u"."email"
           FROM "auth"."users" "u"
          WHERE ("u"."id" = "e"."actor_id")))::"text") AS "actor_email",
    "e"."action",
    "e"."target",
    "e"."detail"
   FROM ( SELECT "l"."id",
            'admin'::"text" AS "source",
            "l"."created_at" AS "at",
            "l"."admin_user_id" AS "actor_id",
            "l"."admin_email" AS "actor_email",
            "l"."action",
            NULLIF("concat_ws"(': '::"text", "l"."target_type", "l"."target_id"), ''::"text") AS "target",
            "l"."metadata" AS "detail"
           FROM "public"."admin_activity_log" "l"
        UNION ALL
         SELECT "o"."id",
            'organizer'::"text" AS "text",
            "o"."created_at",
            "o"."user_id",
            NULL::"text" AS "text",
            ("o"."action")::"text" AS "action",
            NULL::"text" AS "text",
            "o"."additional_data"
           FROM "public"."organizer_logging" "o"
        UNION ALL
         SELECT "d"."id",
            'download'::"text" AS "text",
            "d"."created_at",
            "d"."downloading_user_id",
            NULL::"text" AS "text",
            'downloaded_driver_data'::"text" AS "text",
            ("d"."downloaded_user_data_id")::"text" AS "downloaded_user_data_id",
            "jsonb_build_object"('includesPdf', "d"."includes_pdf", 'startDate', "d"."start_date", 'endDate', "d"."end_date", 'employer', "d"."selected_employer") AS "jsonb_build_object"
           FROM "public"."driver_data_downloads_by_organizers" "d") "e";


ALTER TABLE "public"."admin_audit_events" OWNER TO "postgres";


COMMENT ON VIEW "public"."admin_audit_events" IS 'Normalized union of admin_activity_log, organizer_logging and driver_data_downloads_by_organizers, newest-first keyset-pageable on (at, id). Service-role only; backs /admin/audit.';



CREATE TABLE IF NOT EXISTS "public"."affiliate_organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "key" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "url" character varying(255),
    "signup_code" character varying(255),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "public"."affiliate_organization_status" DEFAULT 'active'::"public"."affiliate_organization_status" NOT NULL,
    "data_deletion_contact_email" character varying(255),
    "driver_signup_code" "text",
    CONSTRAINT "affiliate_organizations_key_check" CHECK ((("key")::"text" <> ''::"text")),
    CONSTRAINT "affiliate_organizations_name_check" CHECK ((("name")::"text" <> ''::"text"))
);


ALTER TABLE "public"."affiliate_organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."argyle_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "argyle_account" "uuid" NOT NULL,
    "employer" "text",
    "argyle_user" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "all_gigs_last_synced_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "all_gigs_last_sync_attempted_at" timestamp with time zone,
    "all_gigs_last_sync_attempt_status" "public"."argyle_sync_status",
    "all_gigs_last_sync_attempt_message" "text",
    "organization_id" "uuid"
);


ALTER TABLE "public"."argyle_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."argyle_accounts"."all_gigs_last_synced_at" IS 'The timestamp of the last **successful** sync for all gigs.';



COMMENT ON COLUMN "public"."argyle_accounts"."deleted_at" IS 'This is the time when the account was deleted from Argyle. We do this periodically to reduce costs for unused accounts.';



COMMENT ON COLUMN "public"."argyle_accounts"."all_gigs_last_sync_attempted_at" IS 'The timestamp of the last sync attempt for all gigs';



COMMENT ON COLUMN "public"."argyle_accounts"."all_gigs_last_sync_attempt_status" IS 'The status of the last sync attempt for all gigs';



COMMENT ON COLUMN "public"."argyle_accounts"."all_gigs_last_sync_attempt_message" IS 'A message providing additional details about the last sync attempt for all gigs. This may come from Argyle or be generated by System.';



CREATE TABLE IF NOT EXISTS "public"."argyle_driver_activities" (
    "id" "text" NOT NULL,
    "account" "uuid",
    "employer" "text",
    "created_at" "text",
    "updated_at" "text",
    "status" "text",
    "type" "text",
    "duration" numeric,
    "timezone" "text",
    "earning_type" "text",
    "start_location_lat" "text",
    "start_location_lng" "text",
    "start_location_formatted_address" "text",
    "end_location_lat" "text",
    "end_location_lng" "text",
    "end_location_formatted_address" "text",
    "distance" numeric,
    "distance_unit" "text",
    "metadata" "text",
    "circumstances_is_pool" "text",
    "circumstances_is_rush" "text",
    "circumstances_is_surge" "text",
    "circumstances_service_type" "text",
    "circumstances_position" integer,
    "income_currency" "text",
    "income_total_charge" numeric,
    "income_fees" numeric,
    "income_total" numeric,
    "income_pay" numeric,
    "income_tips" numeric,
    "income_bonus" numeric,
    "income_rates_hour" numeric,
    "income_rates_mile" numeric,
    "start_location" integer,
    "end_location" integer,
    "metadata_circumstances_is_pool" boolean,
    "metadata_circumstances_is_rush" "text",
    "metadata_circumstances_is_surge" boolean,
    "metadata_circumstances_service_type" "text",
    "metadata_origin_id" "text",
    "end_datetime" timestamp with time zone,
    "start_datetime" timestamp with time zone,
    "task_count" integer,
    "income_other" numeric,
    "user" "uuid",
    "account_id" "uuid",
    "ride_hash" "bytea" NOT NULL
);


ALTER TABLE "public"."argyle_driver_activities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."argyle_driver_activities"."end_datetime" IS 'ISO 8601 timestamp in UTC, see https://docs.argyle.com/api-reference/gigs';



COMMENT ON COLUMN "public"."argyle_driver_activities"."start_datetime" IS 'ISO 8601 timestamp in UTC, see https://docs.argyle.com/api-reference/gigs';



CREATE TABLE IF NOT EXISTS "public"."argyle_items" (
    "id" character varying(255) NOT NULL,
    "name" character varying(255),
    CONSTRAINT "argyle_items_id_check" CHECK ((("id")::"text" ~ '^item_[0-9]{9}$'::"text"))
);


ALTER TABLE "public"."argyle_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."argyle_items" IS 'see https://docs.argyle.com/api-reference/items';



CREATE MATERIALIZED VIEW "public"."daily_driver_stats" AS
 SELECT (("argyle_driver_activities"."start_datetime" AT TIME ZONE 'UTC'::"text"))::"date" AS "stats_date",
    "argyle_driver_activities"."user",
    "argyle_driver_activities"."employer",
    "substring"("argyle_driver_activities"."start_location_formatted_address", ', ([A-Z]{2})(?:, [A-Z]{2})?$'::"text") AS "start_state",
    "substring"("argyle_driver_activities"."end_location_formatted_address", ', ([A-Z]{2})(?:, [A-Z]{2})?$'::"text") AS "end_state",
    "count"(*) AS "daily_trips",
    "sum"("argyle_driver_activities"."distance") AS "sum_distance",
    "sum"("argyle_driver_activities"."income_total_charge") AS "sum_charges",
    "sum"("argyle_driver_activities"."income_total") AS "sum_pay",
    "sum"("argyle_driver_activities"."income_tips") AS "sum_tips",
    "sum"("argyle_driver_activities"."duration") AS "sum_duration"
   FROM "public"."argyle_driver_activities"
  GROUP BY ((("argyle_driver_activities"."start_datetime" AT TIME ZONE 'UTC'::"text"))::"date"), "argyle_driver_activities"."user", "argyle_driver_activities"."employer", ("substring"("argyle_driver_activities"."start_location_formatted_address", ', ([A-Z]{2})(?:, [A-Z]{2})?$'::"text")), ("substring"("argyle_driver_activities"."end_location_formatted_address", ', ([A-Z]{2})(?:, [A-Z]{2})?$'::"text"))
  WITH NO DATA;


ALTER TABLE "public"."daily_driver_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_affiliate_organization_affiliations" (
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "affiliate_organization_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."driver_affiliate_organization_affiliations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_affiliate_organization_data_sharing_consents" (
    "user_id" "uuid" NOT NULL,
    "affiliate_organization_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."driver_affiliate_organization_data_sharing_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."survey_driver_demographics" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "age" integer,
    "gender" "text",
    "sexual_orientation" "text",
    "nationality" "text",
    "gig_work_is" "public"."gig_work_is_enum",
    "in_the_last_12_months_stuggled_to_pay_rent" "public"."in_the_last_12_months_number_of_times_enum",
    "in_the_last_12_months_stuggled_to_pay_utilities" "public"."in_the_last_12_months_number_of_times_enum",
    "in_the_last_12_months_taken_on_debt_for_expenses" "public"."in_the_last_12_months_generic_frequency_enum",
    "in_the_last_12_months_skipped_meals" "public"."in_the_last_12_months_generic_frequency_enum",
    "in_the_last_12_months_skipped_medical_visits" "public"."in_the_last_12_months_generic_frequency_enum",
    "page_visited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "driver_demographic_survey_age_check" CHECK ((("age" >= 18) AND ("age" <= 100)))
);


ALTER TABLE "public"."survey_driver_demographics" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."driver_demographic_survey_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."driver_demographic_survey_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."driver_demographic_survey_id_seq" OWNED BY "public"."survey_driver_demographics"."id";



CREATE TABLE IF NOT EXISTS "public"."driver_signup_code_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "ip_address" "text" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."driver_signup_code_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."survey_fair_take_rate" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "estimate" integer,
    "fair" integer,
    "factors" "text",
    "max_take" numeric,
    "min_take" numeric,
    "average_take" numeric,
    "what_you_think" "text",
    "min_date" "text",
    "max_date" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "consents_to_more_surveys" boolean,
    "vehicle_ownership_status" "text",
    "hours_per_week_of_gig_work" "public"."hours_per_week_of_gig_work_enum",
    "ethnicity" "text",
    "page_visited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "driver_survey_1_estimate_check" CHECK ((("estimate" >= 0) AND ("estimate" <= 100))),
    CONSTRAINT "driver_survey_1_fair_check" CHECK ((("fair" >= 0) AND ("fair" <= 100))),
    CONSTRAINT "driver_survey_1_max_take_check" CHECK ((("max_take" >= (0)::numeric) AND ("max_take" <= (100)::numeric)))
);


ALTER TABLE "public"."survey_fair_take_rate" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."driver_survey_1_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."driver_survey_1_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."driver_survey_1_id_seq" OWNED BY "public"."survey_fair_take_rate"."id";



CREATE TABLE IF NOT EXISTS "public"."emails" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "to" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error" "text",
    "message_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opt_out_survey_responses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "completed_survey" boolean DEFAULT false NOT NULL,
    "survey_left_reason" "text",
    "survey_comments" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."opt_out_survey_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_argyle_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "api_key_id" "text" NOT NULL,
    "api_key_secret" "text" NOT NULL,
    "webhook_secret" "text" NOT NULL,
    "argyle_webhook_subscription_id" "text",
    "link_url" "text" NOT NULL,
    "flow_id" "text",
    "max_argyle_accounts" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "organization_argyle_configs_api_key_id_check" CHECK (("api_key_id" <> ''::"text")),
    CONSTRAINT "organization_argyle_configs_api_key_secret_check" CHECK (("api_key_secret" <> ''::"text")),
    CONSTRAINT "organization_argyle_configs_link_url_check" CHECK (("link_url" <> ''::"text")),
    CONSTRAINT "organization_argyle_configs_max_argyle_accounts_check" CHECK ((("max_argyle_accounts" IS NULL) OR ("max_argyle_accounts" > 0))),
    CONSTRAINT "organization_argyle_configs_webhook_secret_check" CHECK (("webhook_secret" <> ''::"text"))
);


ALTER TABLE "public"."organization_argyle_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role" "public"."organization_role" DEFAULT 'organizer'::"public"."organization_role" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."organizer_affiliate_organization_affiliations" WITH ("security_invoker"='true') AS
 SELECT "m"."created_at",
    "m"."user_id",
    "m"."organization_id" AS "affiliate_organization_id"
   FROM "public"."organization_members" "m";


ALTER TABLE "public"."organizer_affiliate_organization_affiliations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_affiliations_phone_whitelist" (
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "affiliate_organization_id" "uuid" NOT NULL,
    "phone_number" character varying(15) NOT NULL,
    "invited_role" "public"."organization_role" DEFAULT 'organizer'::"public"."organization_role" NOT NULL,
    CONSTRAINT "organizer_affiliations_phone_whitelist_phone_number_check" CHECK ((("phone_number")::"text" ~ '^\d+$'::"text"))
);


ALTER TABLE "public"."organizer_affiliations_phone_whitelist" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."organizer_daily_stats" AS
 SELECT "oaff"."user_id" AS "organizer_id",
    "s"."stats_date",
    "s"."employer",
    "s"."start_state",
    "s"."end_state",
    "count"(DISTINCT "s"."user") AS "total_drivers",
    "sum"("s"."daily_trips") AS "total_trips",
    "sum"("s"."sum_distance") AS "total_distance",
    "sum"("s"."sum_charges") AS "total_charges",
    "sum"("s"."sum_pay") AS "total_pay",
    "sum"("s"."sum_tips") AS "total_tips",
    "sum"("s"."sum_duration") AS "total_duration"
   FROM (("public"."daily_driver_stats" "s"
     JOIN "public"."driver_affiliate_organization_data_sharing_consents" "dcons" ON (("s"."user" = "dcons"."user_id")))
     JOIN "public"."organization_members" "oaff" ON (("dcons"."affiliate_organization_id" = "oaff"."organization_id")))
  GROUP BY "oaff"."user_id", "s"."stats_date", "s"."employer", "s"."start_state", "s"."end_state"
  WITH NO DATA;


ALTER TABLE "public"."organizer_daily_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_analysis_exports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_key" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "filters" "jsonb" NOT NULL,
    "cursor_start_datetime" "text",
    "cursor_id" "text",
    "chunk_count" integer DEFAULT 0 NOT NULL,
    "total_rows" integer DEFAULT 0 NOT NULL,
    "file_path" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    CONSTRAINT "policy_analysis_exports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."policy_analysis_exports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_analysis_refresh_status" (
    "is_singleton" boolean DEFAULT true NOT NULL,
    "last_refreshed_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."policy_analysis_refresh_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "email" "text",
    "last_initial" "text",
    "first_name" "text",
    "address" "text",
    "phone" "text",
    "preferred_language" "text",
    "argyle_user" "uuid",
    "last_sign_in_at" timestamp with time zone,
    CONSTRAINT "profiles_phone_check" CHECK (("phone" ~ '^\d+$'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."received_argyle_webhooks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "response" "jsonb" NOT NULL,
    "received_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."received_argyle_webhooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message_template_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "phone_number" "text" NOT NULL,
    "message" "text" NOT NULL,
    "scheduled_to_send_at" timestamp with time zone NOT NULL,
    "sent_to_twilio_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error" "text"
);


ALTER TABLE "public"."sms_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_participations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "study_shortcode" "public"."study_shortcode_type" NOT NULL,
    "survey_response_id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "post_sync" "public"."study_participations_post_sync" DEFAULT 'send-take-rate'::"public"."study_participations_post_sync" NOT NULL
);


ALTER TABLE "public"."study_participations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."study_participations"."post_sync" IS 'The action to take after this users data has been synced to the study';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."survey_driver_demographics" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."driver_demographic_survey_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."survey_fair_take_rate" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."driver_survey_1_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_activity_log"
    ADD CONSTRAINT "admin_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliate_organizations"
    ADD CONSTRAINT "affiliate_organizations_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."affiliate_organizations"
    ADD CONSTRAINT "affiliate_organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."argyle_accounts"
    ADD CONSTRAINT "argyle_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."argyle_accounts"
    ADD CONSTRAINT "argyle_accounts_user_id_argyle_account_user_id_key" UNIQUE ("argyle_user", "argyle_account", "user_id");



ALTER TABLE ONLY "public"."argyle_driver_activities"
    ADD CONSTRAINT "argyle_driver_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."argyle_driver_activities"
    ADD CONSTRAINT "argyle_driver_activities_ride_hash_unique" UNIQUE ("ride_hash");



ALTER TABLE ONLY "public"."argyle_items"
    ADD CONSTRAINT "argyle_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "argyle_user_unique" UNIQUE ("argyle_user");



ALTER TABLE ONLY "public"."driver_affiliate_organization_affiliations"
    ADD CONSTRAINT "driver_affiliate_organization_affiliations_pkey" PRIMARY KEY ("user_id", "affiliate_organization_id");



ALTER TABLE ONLY "public"."driver_affiliate_organization_data_sharing_consents"
    ADD CONSTRAINT "driver_affiliate_organization_data_sharing_consents_pkey" PRIMARY KEY ("user_id", "affiliate_organization_id");



ALTER TABLE ONLY "public"."driver_data_downloads_by_organizers"
    ADD CONSTRAINT "driver_data_downloads_by_organizers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."survey_driver_demographics"
    ADD CONSTRAINT "driver_demographic_survey_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_signup_code_attempts"
    ADD CONSTRAINT "driver_signup_code_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."survey_fair_take_rate"
    ADD CONSTRAINT "driver_survey_1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opt_out_survey_responses"
    ADD CONSTRAINT "opt_out_survey_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_argyle_configs"
    ADD CONSTRAINT "organization_argyle_configs_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."organization_argyle_configs"
    ADD CONSTRAINT "organization_argyle_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("user_id", "organization_id");



ALTER TABLE ONLY "public"."organizer_affiliations_phone_whitelist"
    ADD CONSTRAINT "organizer_affiliations_phone_whitelist_pkey" PRIMARY KEY ("affiliate_organization_id", "phone_number");



ALTER TABLE ONLY "public"."organizer_logging"
    ADD CONSTRAINT "organizer_logging_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_membership_alerts"
    ADD CONSTRAINT "organizer_membership_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_analysis_exports"
    ADD CONSTRAINT "policy_analysis_exports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_analysis_refresh_status"
    ADD CONSTRAINT "policy_analysis_refresh_status_pkey" PRIMARY KEY ("is_singleton");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."received_argyle_webhooks"
    ADD CONSTRAINT "received_argyle_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_participations"
    ADD CONSTRAINT "study_participations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_participations"
    ADD CONSTRAINT "study_participations_user_id_study_shortcode_key" UNIQUE ("user_id", "study_shortcode");



ALTER TABLE ONLY "public"."opt_out_survey_responses"
    ADD CONSTRAINT "unique_id" UNIQUE ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "unique_phone_number_message_scheduled_to_send_at" UNIQUE ("phone_number", "message", "scheduled_to_send_at");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "admin_activity_log_admin_user_id_idx" ON "public"."admin_activity_log" USING "btree" ("admin_user_id");



CREATE INDEX "admin_activity_log_created_at_id_idx" ON "public"."admin_activity_log" USING "btree" ("created_at" DESC, "id" DESC);



CREATE INDEX "argyle_accounts_organization_id_idx" ON "public"."argyle_accounts" USING "btree" ("organization_id") WHERE ("organization_id" IS NOT NULL);



CREATE INDEX "argyle_driver_activities_account_idx" ON "public"."argyle_driver_activities" USING "btree" ("account");



CREATE INDEX "argyle_driver_activities_user_idx" ON "public"."argyle_driver_activities" USING "btree" ("user");



CREATE UNIQUE INDEX "driver_affiliations_one_primary_per_user" ON "public"."driver_affiliate_organization_affiliations" USING "btree" ("user_id") WHERE ("is_primary" = true);



CREATE INDEX "driver_data_downloads_by_organizers_created_at_id_idx" ON "public"."driver_data_downloads_by_organizers" USING "btree" ("created_at" DESC, "id" DESC);



CREATE INDEX "driver_signup_code_attempts_lookup_idx" ON "public"."driver_signup_code_attempts" USING "btree" ("organization_id", "ip_address", "attempted_at" DESC);



CREATE INDEX "idx_activities_end_state_functional" ON "public"."argyle_driver_activities" USING "btree" ("substring"("end_location_formatted_address", ', ([A-Z]{2})(?:, [A-Z]{2})?$'::"text"));



CREATE INDEX "idx_activities_start_state_functional" ON "public"."argyle_driver_activities" USING "btree" ("substring"("start_location_formatted_address", ', ([A-Z]{2})(?:, [A-Z]{2})?$'::"text"));



CREATE INDEX "idx_argyle_driver_activities_account_id" ON "public"."argyle_driver_activities" USING "btree" ("account_id");



CREATE INDEX "idx_argyle_driver_activities_employer_start_end_datetime" ON "public"."argyle_driver_activities" USING "btree" ("employer", "start_datetime", "end_datetime");



CREATE INDEX "idx_argyle_driver_activities_null_ride_hash" ON "public"."argyle_driver_activities" USING "btree" ("id") WHERE ("ride_hash" IS NULL);



CREATE INDEX "idx_argyle_driver_activities_start_end" ON "public"."argyle_driver_activities" USING "btree" ("start_datetime", "end_datetime");



CREATE INDEX "idx_argyle_driver_activities_start_end_datetime" ON "public"."argyle_driver_activities" USING "btree" ("start_datetime", "end_datetime");



CREATE INDEX "idx_argyle_driver_activities_start_id" ON "public"."argyle_driver_activities" USING "btree" ("start_datetime", "id");



CREATE INDEX "idx_argyle_driver_activities_user_start_id" ON "public"."argyle_driver_activities" USING "btree" ("user", "start_datetime", "id");



CREATE INDEX "idx_consents_affiliate_org_user" ON "public"."driver_affiliate_organization_data_sharing_consents" USING "btree" ("affiliate_organization_id", "user_id");



CREATE UNIQUE INDEX "idx_daily_stats_rls_lookup" ON "public"."daily_driver_stats" USING "btree" ("stats_date", "user", "employer", "start_state", "end_state");



CREATE UNIQUE INDEX "idx_exports_one_active_per_user" ON "public"."policy_analysis_exports" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_exports_status_created" ON "public"."policy_analysis_exports" USING "btree" ("status", "created_at");



CREATE UNIQUE INDEX "idx_org_stats_lookup" ON "public"."organizer_daily_stats" USING "btree" ("organizer_id", "stats_date", "employer", "start_state", "end_state");



CREATE INDEX "organization_members_organization_id_idx" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "organizer_logging_created_at_id_idx" ON "public"."organizer_logging" USING "btree" ("created_at" DESC, "id" DESC);



CREATE INDEX "organizer_membership_alerts_pending_idx" ON "public"."organizer_membership_alerts" USING "btree" ("available_at") WHERE (("sent_at" IS NULL) AND ("abandoned_at" IS NULL));



CREATE UNIQUE INDEX "unique_phone_number_message_template_id" ON "public"."sms_messages" USING "btree" ("phone_number", "message_template_key") WHERE (("message_template_key" <> 'account_already_exists'::"text") AND ("message_template_key" <> 'data_deletion_notification'::"text"));



CREATE OR REPLACE TRIGGER "argyle_driver_activities_generate_hash" BEFORE INSERT OR UPDATE ON "public"."argyle_driver_activities" FOR EACH ROW EXECUTE FUNCTION "public"."generate_ride_hash_on_insert"();



CREATE OR REPLACE TRIGGER "guard_last_admin" BEFORE DELETE OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_last_admin"();



CREATE OR REPLACE TRIGGER "guard_organization_membership" BEFORE INSERT OR DELETE OR UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."guard_organization_membership"();



CREATE OR REPLACE TRIGGER "guard_researcher_assignment" BEFORE INSERT OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_researcher_assignment"();



CREATE OR REPLACE TRIGGER "on_public_profile_updated" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_auth_users_on_public_profile_update"();



CREATE OR REPLACE TRIGGER "organizer_affiliations_instead_of_delete" INSTEAD OF DELETE ON "public"."organizer_affiliate_organization_affiliations" FOR EACH ROW EXECUTE FUNCTION "public"."organizer_affiliations_view_instead_of_delete"();



CREATE OR REPLACE TRIGGER "organizer_affiliations_instead_of_insert" INSTEAD OF INSERT ON "public"."organizer_affiliate_organization_affiliations" FOR EACH ROW EXECUTE FUNCTION "public"."organizer_affiliations_view_instead_of_insert"();



CREATE OR REPLACE TRIGGER "record_organization_membership_creation" AFTER INSERT ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."record_organization_membership_creation"();



CREATE OR REPLACE TRIGGER "update_affiliate_organizations_modtime" BEFORE UPDATE ON "public"."affiliate_organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_driver_affiliate_organization_data_sharing_consents_modt" BEFORE UPDATE ON "public"."driver_affiliate_organization_data_sharing_consents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_driver_demographic_survey_modtime" BEFORE UPDATE ON "public"."survey_driver_demographics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_opt_out_survey_responses_updated_at" BEFORE UPDATE ON "public"."opt_out_survey_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organization_argyle_configs_modtime" BEFORE UPDATE ON "public"."organization_argyle_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_received_argyle_webhooks_modtime" BEFORE UPDATE ON "public"."sms_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sms_messages_modtime" BEFORE UPDATE ON "public"."sms_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_activity_log"
    ADD CONSTRAINT "admin_activity_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."argyle_accounts"
    ADD CONSTRAINT "argyle_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."affiliate_organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."argyle_accounts"
    ADD CONSTRAINT "argyle_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."argyle_driver_activities"
    ADD CONSTRAINT "argyle_driver_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."argyle_accounts"("id");



ALTER TABLE ONLY "public"."argyle_driver_activities"
    ADD CONSTRAINT "argyle_driver_activities_user_fkey" FOREIGN KEY ("user") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_affiliate_organization_affiliations"
    ADD CONSTRAINT "driver_affiliate_organization_af_affiliate_organization_id_fkey" FOREIGN KEY ("affiliate_organization_id") REFERENCES "public"."affiliate_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_affiliate_organization_affiliations"
    ADD CONSTRAINT "driver_affiliate_organization_affiliations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_affiliate_organization_data_sharing_consents"
    ADD CONSTRAINT "driver_affiliate_organization_da_affiliate_organization_id_fkey" FOREIGN KEY ("affiliate_organization_id") REFERENCES "public"."affiliate_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_affiliate_organization_data_sharing_consents"
    ADD CONSTRAINT "driver_affiliate_organization_data_sharing_consent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_data_downloads_by_organizers"
    ADD CONSTRAINT "driver_data_downloads_by_organiz_affiliate_organization_id_fkey" FOREIGN KEY ("affiliate_organization_id") REFERENCES "public"."affiliate_organizations"("id");



ALTER TABLE ONLY "public"."driver_data_downloads_by_organizers"
    ADD CONSTRAINT "driver_data_downloads_by_organizers_downloaded_user_data_id_fke" FOREIGN KEY ("downloaded_user_data_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_data_downloads_by_organizers"
    ADD CONSTRAINT "driver_data_downloads_by_organizers_downloading_user_id_fkey" FOREIGN KEY ("downloading_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."survey_driver_demographics"
    ADD CONSTRAINT "driver_demographic_survey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_signup_code_attempts"
    ADD CONSTRAINT "driver_signup_code_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."affiliate_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."survey_fair_take_rate"
    ADD CONSTRAINT "driver_survey_1_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."argyle_accounts"
    ADD CONSTRAINT "fk_argyle_accounts_profiles_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_affiliate_organization_data_sharing_consents"
    ADD CONSTRAINT "fk_driver_affiliate_organization_data_sharing_consents_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_participations"
    ADD CONSTRAINT "fk_study_participations_profiles_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_argyle_configs"
    ADD CONSTRAINT "organization_argyle_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."affiliate_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."affiliate_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_affiliations_phone_whitelist"
    ADD CONSTRAINT "organizer_affiliations_phone_whi_affiliate_organization_id_fkey" FOREIGN KEY ("affiliate_organization_id") REFERENCES "public"."affiliate_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_logging"
    ADD CONSTRAINT "organizer_logging_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."policy_analysis_exports"
    ADD CONSTRAINT "policy_analysis_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_participations"
    ADD CONSTRAINT "study_participations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated users to select their user_roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow organizers to view affiliate organization consents for th" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR SELECT TO "authenticated" USING ("public"."has_org_role"("affiliate_organization_id", 'organizer'::"public"."organization_role"));



CREATE POLICY "Allow organizers to view consenting driver activities" ON "public"."argyle_driver_activities" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user") OR (EXISTS ( SELECT 1
   FROM "public"."driver_affiliate_organization_data_sharing_consents" "consents"
  WHERE (("argyle_driver_activities"."user" = "consents"."user_id") AND "public"."has_org_role"("consents"."affiliate_organization_id", 'organizer'::"public"."organization_role"))))));



CREATE POLICY "Allow organizers to view consenting driver's argyle_accounts" ON "public"."argyle_accounts" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."driver_affiliate_organization_data_sharing_consents" "consents"
  WHERE (("argyle_accounts"."user_id" = "consents"."user_id") AND "public"."has_org_role"("consents"."affiliate_organization_id", 'organizer'::"public"."organization_role"))))));



CREATE POLICY "Allow organizers to view consenting driver's profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."driver_affiliate_organization_data_sharing_consents" "consents"
  WHERE (("profiles"."user_id" = "consents"."user_id") AND "public"."has_org_role"("consents"."affiliate_organization_id", 'organizer'::"public"."organization_role"))))));



CREATE POLICY "Delete only only matching users" ON "public"."driver_affiliate_organization_affiliations" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Delete only only matching users" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."survey_driver_demographics" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."survey_fair_take_rate" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for users based on user ID" ON "public"."driver_affiliate_organization_affiliations" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert for users based on user ID" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable read access for matching users" ON "public"."survey_driver_demographics" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable read access for matching users" ON "public"."survey_fair_take_rate" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable update for users based on user ID" ON "public"."argyle_driver_activities" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user"));



CREATE POLICY "Enable update for users based on user ID" ON "public"."driver_affiliate_organization_affiliations" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable update for users based on user ID" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable users to manage their own study_participations" ON "public"."study_participations" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Prevent authenticated users from modifying user_roles" ON "public"."user_roles" TO "authenticated" USING (false);



CREATE POLICY "Public read-only access" ON "public"."affiliate_organizations" USING (true) WITH CHECK (false);



CREATE POLICY "Read access to only matching users" ON "public"."argyle_driver_activities" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user"));



CREATE POLICY "Read access to only matching users" ON "public"."driver_affiliate_organization_affiliations" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Read access to only matching users" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Service role manages organization argyle configs" ON "public"."organization_argyle_configs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages signup code attempts" ON "public"."driver_signup_code_attempts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can insert own rows" ON "public"."argyle_accounts" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own rows" ON "public"."argyle_accounts" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."admin_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."affiliate_organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."argyle_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."argyle_driver_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."argyle_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "argyle_items_policy" ON "public"."argyle_items" FOR SELECT USING (false);



ALTER TABLE "public"."driver_affiliate_organization_affiliations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_affiliate_organization_data_sharing_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_data_downloads_by_organizers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_signup_code_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emails" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no one can select from audit log" ON "public"."driver_data_downloads_by_organizers" FOR SELECT USING (false);



ALTER TABLE "public"."opt_out_survey_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_argyle_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_members_select_own" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."organizer_affiliations_phone_whitelist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizer_can_insert_audit_rows" ON "public"."driver_data_downloads_by_organizers" FOR INSERT WITH CHECK (("downloading_user_id" = "auth"."uid"()));



ALTER TABLE "public"."organizer_logging" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_membership_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "phone_match_policy" ON "public"."sms_messages" USING (("phone_number" = ( SELECT "profiles"."phone"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("phone_number" = ( SELECT "profiles"."phone"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."policy_analysis_exports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."policy_analysis_refresh_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."received_argyle_webhooks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_own_exports" ON "public"."policy_analysis_exports" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."sms_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_participations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."survey_driver_demographics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."survey_fair_take_rate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;






-- Supabase's default privileges grant everything on new objects to anon,
-- authenticated and service_role. Clear those so the explicit grants below are
-- the complete set, as they were when this schema was dumped.
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "anon", "authenticated", "service_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "anon", "authenticated", "service_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM "anon", "authenticated", "service_role";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";




































































































































































































































































































































GRANT ALL ON TABLE "public"."organizer_membership_alerts" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_organizer_membership_alerts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_organizer_membership_alerts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."connect_argyle_account_with_capacity"("p_user_id" "uuid", "p_argyle_user" "text", "p_argyle_account" "text", "p_organization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."connect_argyle_account_with_capacity"("p_user_id" "uuid", "p_argyle_user" "text", "p_argyle_account" "text", "p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ride_hash"("p_user" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_start_location_lat" "text", "p_start_location_lng" "text", "p_end_location_lat" "text", "p_end_location_lng" "text", "p_income_total" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ride_hash"("p_user" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_start_location_lat" "text", "p_start_location_lng" "text", "p_end_location_lat" "text", "p_end_location_lng" "text", "p_income_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ride_hash"("p_user" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_start_location_lat" "text", "p_start_location_lng" "text", "p_end_location_lat" "text", "p_end_location_lng" "text", "p_income_total" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ride_hash_on_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ride_hash_on_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ride_hash_on_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ride_hash_string_double_bar_concatenation"("user_id" "uuid", "start_datetime" timestamp with time zone, "end_datetime" timestamp with time zone, "start_location_lat" "text", "start_location_lng" "text", "end_location_lat" "text", "end_location_lng" "text", "income_total" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ride_hash_string_double_bar_concatenation"("user_id" "uuid", "start_datetime" timestamp with time zone, "end_datetime" timestamp with time zone, "start_location_lat" "text", "start_location_lng" "text", "end_location_lat" "text", "end_location_lng" "text", "income_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ride_hash_string_double_bar_concatenation"("user_id" "uuid", "start_datetime" timestamp with time zone, "end_datetime" timestamp with time zone, "start_location_lat" "text", "start_location_lng" "text", "end_location_lat" "text", "end_location_lng" "text", "income_total" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_policy_analysis_aggregates"("p_start_date" "text", "p_end_date" "text", "p_location" "text", "p_driver_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_policy_analysis_aggregates"("p_start_date" "text", "p_end_date" "text", "p_location" "text", "p_driver_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_policy_analysis_csv_rows"("p_start_date" "text", "p_end_date" "text", "p_start_location" "text", "p_end_location" "text", "p_location_and" boolean, "p_platforms" "text"[], "p_driver_ids" "uuid"[], "p_limit" integer, "p_cursor_start_datetime" timestamp with time zone, "p_cursor_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_policy_analysis_csv_rows"("p_start_date" "text", "p_end_date" "text", "p_start_location" "text", "p_end_location" "text", "p_location_and" boolean, "p_platforms" "text"[], "p_driver_ids" "uuid"[], "p_limit" integer, "p_cursor_start_datetime" timestamp with time zone, "p_cursor_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_policy_analysis_stats"("in_start_date" "text", "in_end_date" "text", "in_employers" "text"[], "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean, "in_driver_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_policy_analysis_stats"("in_start_date" "text", "in_end_date" "text", "in_employers" "text"[], "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean, "in_driver_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_policy_analysis_stats_aggregate"("in_start_date" "text", "in_end_date" "text", "in_employers" "text", "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_policy_analysis_stats_aggregate"("in_start_date" "text", "in_end_date" "text", "in_employers" "text", "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_policy_analysis_stats_batch"("in_start_date" "text", "in_end_date" "text", "in_employers" "text"[], "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean, "in_driver_ids" "uuid"[], "in_cursor_start_datetime" timestamp with time zone, "in_cursor_id" "text", "in_batch_size" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_policy_analysis_stats_batch"("in_start_date" "text", "in_end_date" "text", "in_employers" "text"[], "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean, "in_driver_ids" "uuid"[], "in_cursor_start_datetime" timestamp with time zone, "in_cursor_id" "text", "in_batch_size" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_sick_time_stats"("in_driver_id" "uuid", "in_start_date" "text", "in_end_date" "text", "in_rate_start_date" "text", "in_rate_end_date" "text", "in_employers" "text"[], "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_sick_time_stats"("in_driver_id" "uuid", "in_start_date" "text", "in_end_date" "text", "in_rate_start_date" "text", "in_rate_end_date" "text", "in_employers" "text"[], "in_start_state" "text", "in_end_state" "text", "in_match_all_states" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_last_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_last_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_organization_membership"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_organization_membership"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_researcher_assignment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_researcher_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_user_last_sign_in_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_user_last_sign_in_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_user_last_sign_in_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_org_role"("p_org_id" "uuid", "p_min" "public"."organization_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_org_role"("p_org_id" "uuid", "p_min" "public"."organization_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_org_role"("p_org_id" "uuid", "p_min" "public"."organization_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_org_role"("p_org_id" "uuid", "p_min" "public"."organization_role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_platform_role"("p_role" "public"."user_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_platform_role"("p_role" "public"."user_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_platform_role"("p_role" "public"."user_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_platform_role"("p_role" "public"."user_role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."invite_organization_member"("p_organization_id" "uuid", "p_phone" "text", "p_role" "public"."organization_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_organization_member"("p_organization_id" "uuid", "p_phone" "text", "p_role" "public"."organization_role") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_organization_member"("p_organization_id" "uuid", "p_phone" "text", "p_role" "public"."organization_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_organization_member"("p_organization_id" "uuid", "p_phone" "text", "p_role" "public"."organization_role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_organization_from_invite"("p_user_id" "uuid", "p_organization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_organization_from_invite"("p_user_id" "uuid", "p_organization_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."membership_guard_bypassed"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."membership_guard_bypassed"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."organization_role_rank"("p_role" "public"."organization_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."organization_role_rank"("p_role" "public"."organization_role") TO "anon";
GRANT ALL ON FUNCTION "public"."organization_role_rank"("p_role" "public"."organization_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."organization_role_rank"("p_role" "public"."organization_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."organizer_affiliations_view_instead_of_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."organizer_affiliations_view_instead_of_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."organizer_affiliations_view_instead_of_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."organizer_affiliations_view_instead_of_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."organizer_affiliations_view_instead_of_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."organizer_affiliations_view_instead_of_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_profiles_from_user_table"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_profiles_from_user_table"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_profiles_from_user_table"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_organization_membership_creation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_organization_membership_creation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_policy_analysis_views"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_policy_analysis_views"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_organization_member"("p_organization_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_organization_member"("p_organization_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_organization_member"("p_organization_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_organization_member"("p_organization_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_organization_invite"("p_organization_id" "uuid", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_organization_invite"("p_organization_id" "uuid", "p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_organization_invite"("p_organization_id" "uuid", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_organization_invite"("p_organization_id" "uuid", "p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_organization_member_role"("p_organization_id" "uuid", "p_user_id" "uuid", "p_role" "public"."organization_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_organization_member_role"("p_organization_id" "uuid", "p_user_id" "uuid", "p_role" "public"."organization_role") TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_member_role"("p_organization_id" "uuid", "p_user_id" "uuid", "p_role" "public"."organization_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_member_role"("p_organization_id" "uuid", "p_user_id" "uuid", "p_role" "public"."organization_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."stop_sharing_primary"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."stop_sharing_primary"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_auth_users_on_public_profile_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_auth_users_on_public_profile_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_auth_users_on_public_profile_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";



























GRANT ALL ON TABLE "public"."admin_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."driver_data_downloads_by_organizers" TO "anon";
GRANT ALL ON TABLE "public"."driver_data_downloads_by_organizers" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_data_downloads_by_organizers" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_logging" TO "anon";
GRANT ALL ON TABLE "public"."organizer_logging" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_logging" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."affiliate_organizations" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."affiliate_organizations" TO "anon";
GRANT SELECT("id") ON TABLE "public"."affiliate_organizations" TO "authenticated";



GRANT SELECT("key") ON TABLE "public"."affiliate_organizations" TO "anon";
GRANT SELECT("key") ON TABLE "public"."affiliate_organizations" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."affiliate_organizations" TO "anon";
GRANT SELECT("name") ON TABLE "public"."affiliate_organizations" TO "authenticated";



GRANT SELECT("url") ON TABLE "public"."affiliate_organizations" TO "anon";
GRANT SELECT("url") ON TABLE "public"."affiliate_organizations" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."affiliate_organizations" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."affiliate_organizations" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."affiliate_organizations" TO "anon";
GRANT SELECT("updated_at") ON TABLE "public"."affiliate_organizations" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."affiliate_organizations" TO "anon";
GRANT SELECT("status") ON TABLE "public"."affiliate_organizations" TO "authenticated";



GRANT ALL ON TABLE "public"."argyle_accounts" TO "anon";
GRANT ALL ON TABLE "public"."argyle_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."argyle_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."argyle_driver_activities" TO "anon";
GRANT ALL ON TABLE "public"."argyle_driver_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."argyle_driver_activities" TO "service_role";



GRANT ALL ON TABLE "public"."argyle_items" TO "anon";
GRANT ALL ON TABLE "public"."argyle_items" TO "authenticated";
GRANT ALL ON TABLE "public"."argyle_items" TO "service_role";



GRANT ALL ON TABLE "public"."daily_driver_stats" TO "service_role";



GRANT ALL ON TABLE "public"."driver_affiliate_organization_affiliations" TO "anon";
GRANT ALL ON TABLE "public"."driver_affiliate_organization_affiliations" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_affiliate_organization_affiliations" TO "service_role";



GRANT ALL ON TABLE "public"."driver_affiliate_organization_data_sharing_consents" TO "anon";
GRANT ALL ON TABLE "public"."driver_affiliate_organization_data_sharing_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_affiliate_organization_data_sharing_consents" TO "service_role";



GRANT ALL ON TABLE "public"."survey_driver_demographics" TO "anon";
GRANT ALL ON TABLE "public"."survey_driver_demographics" TO "authenticated";
GRANT ALL ON TABLE "public"."survey_driver_demographics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."driver_demographic_survey_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."driver_demographic_survey_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."driver_demographic_survey_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."driver_signup_code_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."survey_fair_take_rate" TO "anon";
GRANT ALL ON TABLE "public"."survey_fair_take_rate" TO "authenticated";
GRANT ALL ON TABLE "public"."survey_fair_take_rate" TO "service_role";



GRANT ALL ON SEQUENCE "public"."driver_survey_1_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."driver_survey_1_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."driver_survey_1_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."emails" TO "anon";
GRANT ALL ON TABLE "public"."emails" TO "authenticated";
GRANT ALL ON TABLE "public"."emails" TO "service_role";



GRANT ALL ON TABLE "public"."opt_out_survey_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."opt_out_survey_responses" TO "service_role";
GRANT INSERT ON TABLE "public"."opt_out_survey_responses" TO "anon";



GRANT ALL ON TABLE "public"."organization_argyle_configs" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "service_role";
GRANT SELECT ON TABLE "public"."organization_members" TO "authenticated";



GRANT ALL ON TABLE "public"."organizer_affiliate_organization_affiliations" TO "service_role";
GRANT SELECT ON TABLE "public"."organizer_affiliate_organization_affiliations" TO "authenticated";



GRANT ALL ON TABLE "public"."organizer_affiliations_phone_whitelist" TO "anon";
GRANT ALL ON TABLE "public"."organizer_affiliations_phone_whitelist" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_affiliations_phone_whitelist" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_daily_stats" TO "service_role";



GRANT ALL ON TABLE "public"."policy_analysis_exports" TO "anon";
GRANT ALL ON TABLE "public"."policy_analysis_exports" TO "authenticated";
GRANT ALL ON TABLE "public"."policy_analysis_exports" TO "service_role";



GRANT ALL ON TABLE "public"."policy_analysis_refresh_status" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."received_argyle_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."received_argyle_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."received_argyle_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."sms_messages" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."sms_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_messages" TO "anon";



GRANT ALL ON TABLE "public"."study_participations" TO "anon";
GRANT ALL ON TABLE "public"."study_participations" TO "authenticated";
GRANT ALL ON TABLE "public"."study_participations" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;


--
-- Objects outside the public schema
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.populate_profiles_from_user_table();
CREATE TRIGGER on_auth_user_last_sign_in_at_updated AFTER UPDATE OF last_sign_in_at ON auth.users FOR EACH ROW WHEN ((new.last_sign_in_at IS DISTINCT FROM old.last_sign_in_at)) EXECUTE FUNCTION public.handle_updated_user_last_sign_in_at();

CREATE POLICY exports_service_insert ON storage.objects FOR INSERT WITH CHECK ((bucket_id = 'exports'::text) AND (( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY exports_service_select ON storage.objects FOR SELECT USING ((bucket_id = 'exports'::text) AND (( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY exports_service_delete ON storage.objects FOR DELETE USING ((bucket_id = 'exports'::text) AND (( SELECT auth.role() AS role) = 'service_role'::text));


--
-- Reference data
--

INSERT INTO "public"."affiliate_organizations" ("key", "name", "url", "status") VALUES
	('pelq', 'PELQ', 'https://example.org', 'active'),
	('opl', 'OPL', 'https://example.org', 'active'),
	('du', 'LPC', 'https://example.org', 'active'),
	('gls', 'GLS', 'https://example.org', 'active'),
	('other', 'Other', NULL, 'active'),
	('edl', 'EDL', 'https://example.org', 'active'),
	('rtk', 'RTK', 'https://example.org', 'active');

INSERT INTO "public"."argyle_items" ("id", "name") VALUES
	('item_000024123', 'lyft'),
	('item_000041078', 'uber'),
	('item_000012375', 'doordash'),
	('item_000017676', 'grubhub'),
	('item_000041080', 'ubereats'),
	('item_000031099', 'postmates');

INSERT INTO "public"."policy_analysis_refresh_status" ("is_singleton", "last_refreshed_at") VALUES
	(true, now() AT TIME ZONE 'UTC');

INSERT INTO "storage"."buckets" ("id", "name", "public") VALUES
	('exports', 'exports', false);

SELECT cron.schedule('cleanup-cron-history', '0 0 * * *', $$DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '7 days'$$);
SELECT cron.schedule('refresh-policy-views', '0 6 * * *', $$SET statement_timeout = '10min'; SELECT refresh_policy_analysis_views();$$);
