

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


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






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


CREATE TYPE "public"."organizer_log_action" AS ENUM (
    'logged_in',
    'downloaded_user_data',
    'generated_user_report',
    'viewed_user_page'
);


ALTER TYPE "public"."organizer_log_action" OWNER TO "postgres";


CREATE TYPE "public"."study_participations_post_sync" AS ENUM (
    'send-take-rate',
    'do-nothing',
    'send-thank-you'
);


ALTER TYPE "public"."study_participations_post_sync" OWNER TO "postgres";


CREATE TYPE "public"."study_shortcode_type" AS ENUM (
    'edl'
);


ALTER TYPE "public"."study_shortcode_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'driver',
    'organizer'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


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

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."affiliate_organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "key" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "url" character varying(255),
    "signup_code" character varying(255),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "public"."affiliate_organization_status" DEFAULT 'active'::"public"."affiliate_organization_status" NOT NULL,
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
    "all_gigs_last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."argyle_accounts" OWNER TO "postgres";


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
    "user" "uuid"
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



CREATE TABLE IF NOT EXISTS "public"."driver_affiliate_organization_affiliations" (
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "affiliate_organization_id" "uuid" NOT NULL
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



CREATE TABLE IF NOT EXISTS "public"."opt_out_survey_responses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "completed_survey" boolean DEFAULT false NOT NULL,
    "survey_left_reason" "text",
    "survey_comments" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."opt_out_survey_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_affiliate_organization_affiliations" (
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "affiliate_organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."organizer_affiliate_organization_affiliations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_affiliations_phone_whitelist" (
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "affiliate_organization_id" "uuid" NOT NULL,
    "phone_number" character varying(15) NOT NULL,
    CONSTRAINT "organizer_affiliations_phone_whitelist_phone_number_check" CHECK ((("phone_number")::"text" ~ '^\d+$'::"text"))
);


ALTER TABLE "public"."organizer_affiliations_phone_whitelist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_logging" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "action" "public"."organizer_log_action" NOT NULL,
    "additional_data" "jsonb"
);


ALTER TABLE "public"."organizer_logging" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "email" "text",
    "last_name" "text",
    "first_name" "text",
    "address" "text",
    "phone" "text",
    "preferred_language" "text",
    "argyle_user" "uuid",
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



ALTER TABLE ONLY "public"."affiliate_organizations"
    ADD CONSTRAINT "affiliate_organizations_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."affiliate_organizations"
    ADD CONSTRAINT "affiliate_organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."argyle_accounts"
    ADD CONSTRAINT "argyle_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."argyle_driver_activities"
    ADD CONSTRAINT "argyle_driver_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."argyle_items"
    ADD CONSTRAINT "argyle_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "argyle_user_unique" UNIQUE ("argyle_user");



ALTER TABLE ONLY "public"."driver_affiliate_organization_affiliations"
    ADD CONSTRAINT "driver_affiliate_organization_affiliations_pkey" PRIMARY KEY ("user_id", "affiliate_organization_id");



ALTER TABLE ONLY "public"."driver_affiliate_organization_data_sharing_consents"
    ADD CONSTRAINT "driver_affiliate_organization_data_sharing_consents_pkey" PRIMARY KEY ("user_id", "affiliate_organization_id");



ALTER TABLE ONLY "public"."survey_driver_demographics"
    ADD CONSTRAINT "driver_demographic_survey_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."survey_fair_take_rate"
    ADD CONSTRAINT "driver_survey_1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opt_out_survey_responses"
    ADD CONSTRAINT "opt_out_survey_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_affiliate_organization_affiliations"
    ADD CONSTRAINT "organizer_affiliate_organization_affiliations_pkey" PRIMARY KEY ("user_id", "affiliate_organization_id");



ALTER TABLE ONLY "public"."organizer_affiliations_phone_whitelist"
    ADD CONSTRAINT "organizer_affiliations_phone_whitelist_pkey" PRIMARY KEY ("affiliate_organization_id", "phone_number");



ALTER TABLE ONLY "public"."organizer_logging"
    ADD CONSTRAINT "organizer_logging_pkey" PRIMARY KEY ("id");



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



CREATE UNIQUE INDEX "argyle_accounts_argyle_account_key" ON "public"."argyle_accounts" USING "btree" ("argyle_account");



CREATE UNIQUE INDEX "argyle_accounts_user_id_argyle_account_key" ON "public"."argyle_accounts" USING "btree" ("argyle_user", "argyle_account");



CREATE INDEX "argyle_driver_activities_account_idx" ON "public"."argyle_driver_activities" USING "btree" ("account");



CREATE INDEX "argyle_driver_activities_user_idx" ON "public"."argyle_driver_activities" USING "btree" ("user");



CREATE UNIQUE INDEX "unique_phone_number_message_template_id" ON "public"."sms_messages" USING "btree" ("phone_number", "message_template_key") WHERE ("message_template_key" <> 'account_already_exists'::"text");



CREATE OR REPLACE TRIGGER "on_public_profile_updated" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_auth_users_on_public_profile_update"();



CREATE OR REPLACE TRIGGER "update_affiliate_organizations_modtime" BEFORE UPDATE ON "public"."affiliate_organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_driver_affiliate_organization_data_sharing_consents_modt" BEFORE UPDATE ON "public"."driver_affiliate_organization_data_sharing_consents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_driver_demographic_survey_modtime" BEFORE UPDATE ON "public"."survey_driver_demographics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_opt_out_survey_responses_updated_at" BEFORE UPDATE ON "public"."opt_out_survey_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_received_argyle_webhooks_modtime" BEFORE UPDATE ON "public"."sms_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sms_messages_modtime" BEFORE UPDATE ON "public"."sms_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."argyle_accounts"
    ADD CONSTRAINT "argyle_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."argyle_driver_activities"
    ADD CONSTRAINT "argyle_driver_activities_argyle_account_fkey" FOREIGN KEY ("account") REFERENCES "public"."argyle_accounts"("argyle_account") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."survey_driver_demographics"
    ADD CONSTRAINT "driver_demographic_survey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."survey_fair_take_rate"
    ADD CONSTRAINT "driver_survey_1_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."argyle_accounts"
    ADD CONSTRAINT "fk_argyle_accounts_profiles_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_affiliate_organization_data_sharing_consents"
    ADD CONSTRAINT "fk_driver_affiliate_organization_data_sharing_consents_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_participations"
    ADD CONSTRAINT "fk_study_participations_profiles_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_affiliate_organization_affiliations"
    ADD CONSTRAINT "organizer_affiliate_organization_affiliate_organization_id_fkey" FOREIGN KEY ("affiliate_organization_id") REFERENCES "public"."affiliate_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_affiliate_organization_affiliations"
    ADD CONSTRAINT "organizer_affiliate_organization_affiliations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_affiliations_phone_whitelist"
    ADD CONSTRAINT "organizer_affiliations_phone_whi_affiliate_organization_id_fkey" FOREIGN KEY ("affiliate_organization_id") REFERENCES "public"."affiliate_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_logging"
    ADD CONSTRAINT "organizer_logging_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_participations"
    ADD CONSTRAINT "study_participations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated users to select their organizer_affiliate_o" ON "public"."organizer_affiliate_organization_affiliations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow authenticated users to select their user_roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow organizers to view affiliate organization consents for th" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'organizer'::"public"."user_role")))) AND (EXISTS ( SELECT 1
   FROM "public"."organizer_affiliate_organization_affiliations"
  WHERE (("organizer_affiliate_organization_affiliations"."user_id" = "auth"."uid"()) AND ("organizer_affiliate_organization_affiliations"."affiliate_organization_id" = "driver_affiliate_organization_data_sharing_consents"."affiliate_organization_id"))))));



CREATE POLICY "Allow organizers to view consenting driver activities" ON "public"."argyle_driver_activities" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user") OR ((EXISTS ( SELECT 1
   FROM "public"."driver_affiliate_organization_data_sharing_consents"
  WHERE (("argyle_driver_activities"."user" = "driver_affiliate_organization_data_sharing_consents"."user_id") AND ("driver_affiliate_organization_data_sharing_consents"."affiliate_organization_id" IN ( SELECT "organizer_affiliate_organization_affiliations"."affiliate_organization_id"
           FROM "public"."organizer_affiliate_organization_affiliations"
          WHERE ("organizer_affiliate_organization_affiliations"."user_id" = "auth"."uid"())))))) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'organizer'::"public"."user_role")))))));



CREATE POLICY "Allow organizers to view consenting driver's argyle_accounts" ON "public"."argyle_accounts" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR ((EXISTS ( SELECT 1
   FROM "public"."driver_affiliate_organization_data_sharing_consents"
  WHERE (("argyle_accounts"."user_id" = "driver_affiliate_organization_data_sharing_consents"."user_id") AND ("driver_affiliate_organization_data_sharing_consents"."affiliate_organization_id" IN ( SELECT "organizer_affiliate_organization_affiliations"."affiliate_organization_id"
           FROM "public"."organizer_affiliate_organization_affiliations"
          WHERE ("organizer_affiliate_organization_affiliations"."user_id" = "auth"."uid"())))))) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'organizer'::"public"."user_role")))))));



CREATE POLICY "Allow organizers to view consenting driver's profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR ((EXISTS ( SELECT 1
   FROM "public"."driver_affiliate_organization_data_sharing_consents"
  WHERE (("profiles"."user_id" = "driver_affiliate_organization_data_sharing_consents"."user_id") AND ("driver_affiliate_organization_data_sharing_consents"."affiliate_organization_id" IN ( SELECT "organizer_affiliate_organization_affiliations"."affiliate_organization_id"
           FROM "public"."organizer_affiliate_organization_affiliations"
          WHERE ("organizer_affiliate_organization_affiliations"."user_id" = "auth"."uid"())))))) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'organizer'::"public"."user_role")))))));



CREATE POLICY "Delete only only matching users" ON "public"."driver_affiliate_organization_affiliations" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Delete only only matching users" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."survey_driver_demographics" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."survey_fair_take_rate" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for users based on user ID" ON "public"."driver_affiliate_organization_affiliations" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert for users based on user ID" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable read access for matching users" ON "public"."survey_driver_demographics" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable read access for matching users" ON "public"."survey_fair_take_rate" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable update for users based on user ID" ON "public"."argyle_driver_activities" FOR UPDATE USING (("auth"."uid"() = "user")) WITH CHECK (("auth"."uid"() = "user"));



CREATE POLICY "Enable update for users based on user ID" ON "public"."driver_affiliate_organization_affiliations" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable update for users based on user ID" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable users to manage their own study_participations" ON "public"."study_participations" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Prevent authenticated users from modifying user_roles" ON "public"."user_roles" TO "authenticated" USING (false);



CREATE POLICY "Public read-only access" ON "public"."affiliate_organizations" USING (true) WITH CHECK (false);



CREATE POLICY "Read access to only matching users" ON "public"."argyle_driver_activities" FOR SELECT USING (("auth"."uid"() = "user"));



CREATE POLICY "Read access to only matching users" ON "public"."driver_affiliate_organization_affiliations" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Read access to only matching users" ON "public"."driver_affiliate_organization_data_sharing_consents" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own rows" ON "public"."argyle_accounts" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own rows" ON "public"."argyle_accounts" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."affiliate_organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."argyle_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."argyle_driver_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "argyle_items_policy" ON "public"."argyle_items" FOR SELECT USING (false);



ALTER TABLE "public"."driver_affiliate_organization_affiliations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_affiliate_organization_data_sharing_consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no_authenticated_delete_organizer_affiliate_organization_affili" ON "public"."organizer_affiliate_organization_affiliations" AS RESTRICTIVE FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "no_authenticated_insert_organizer_affiliate_organization_affili" ON "public"."organizer_affiliate_organization_affiliations" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "no_authenticated_update_organizer_affiliate_organization_affili" ON "public"."organizer_affiliate_organization_affiliations" AS RESTRICTIVE FOR UPDATE TO "authenticated" USING (false);



ALTER TABLE "public"."opt_out_survey_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_affiliate_organization_affiliations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_affiliations_phone_whitelist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_logging" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "phone_match_policy" ON "public"."sms_messages" USING (("phone_number" = ( SELECT "profiles"."phone"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("phone_number" = ( SELECT "profiles"."phone"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."received_argyle_webhooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_participations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."survey_driver_demographics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."survey_fair_take_rate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































































































































GRANT ALL ON FUNCTION "public"."populate_profiles_from_user_table"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_profiles_from_user_table"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_profiles_from_user_table"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_auth_users_on_public_profile_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_auth_users_on_public_profile_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_auth_users_on_public_profile_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";





















GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE ON TABLE "public"."affiliate_organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_organizations" TO "service_role";



GRANT ALL ON TABLE "public"."argyle_accounts" TO "anon";
GRANT ALL ON TABLE "public"."argyle_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."argyle_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."argyle_driver_activities" TO "anon";
GRANT ALL ON TABLE "public"."argyle_driver_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."argyle_driver_activities" TO "service_role";



GRANT ALL ON TABLE "public"."argyle_items" TO "anon";
GRANT ALL ON TABLE "public"."argyle_items" TO "authenticated";
GRANT ALL ON TABLE "public"."argyle_items" TO "service_role";



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



GRANT ALL ON TABLE "public"."survey_fair_take_rate" TO "anon";
GRANT ALL ON TABLE "public"."survey_fair_take_rate" TO "authenticated";
GRANT ALL ON TABLE "public"."survey_fair_take_rate" TO "service_role";



GRANT ALL ON SEQUENCE "public"."driver_survey_1_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."driver_survey_1_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."driver_survey_1_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."opt_out_survey_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."opt_out_survey_responses" TO "service_role";
GRANT INSERT ON TABLE "public"."opt_out_survey_responses" TO "anon";



GRANT ALL ON TABLE "public"."organizer_affiliate_organization_affiliations" TO "anon";
GRANT ALL ON TABLE "public"."organizer_affiliate_organization_affiliations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_affiliate_organization_affiliations" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_affiliations_phone_whitelist" TO "anon";
GRANT ALL ON TABLE "public"."organizer_affiliations_phone_whitelist" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_affiliations_phone_whitelist" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_logging" TO "anon";
GRANT ALL ON TABLE "public"."organizer_logging" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_logging" TO "service_role";



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
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."populate_profiles_from_user_table"();



