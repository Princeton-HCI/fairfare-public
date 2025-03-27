export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      affiliate_organizations: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          name: string;
          signup_code: string | null;
          status: Database['public']['Enums']['affiliate_organization_status'];
          updated_at: string;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          name: string;
          signup_code?: string | null;
          status?: Database['public']['Enums']['affiliate_organization_status'];
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          name?: string;
          signup_code?: string | null;
          status?: Database['public']['Enums']['affiliate_organization_status'];
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      argyle_accounts: {
        Row: {
          all_gigs_last_synced_at: string | null;
          argyle_account: string;
          argyle_user: string;
          created_at: string;
          employer: string | null;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          all_gigs_last_synced_at?: string | null;
          argyle_account: string;
          argyle_user: string;
          created_at?: string;
          employer?: string | null;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          all_gigs_last_synced_at?: string | null;
          argyle_account?: string;
          argyle_user?: string;
          created_at?: string;
          employer?: string | null;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_argyle_accounts_profiles_user_id';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          }
        ];
      };
      argyle_driver_activities: {
        Row: {
          account: string | null;
          circumstances_is_pool: string | null;
          circumstances_is_rush: string | null;
          circumstances_is_surge: string | null;
          circumstances_position: number | null;
          circumstances_service_type: string | null;
          created_at: string | null;
          distance: number | null;
          distance_unit: string | null;
          duration: number | null;
          earning_type: string | null;
          employer: string | null;
          end_datetime: string | null;
          end_location: number | null;
          end_location_formatted_address: string | null;
          end_location_lat: string | null;
          end_location_lng: string | null;
          id: string;
          income_bonus: number | null;
          income_currency: string | null;
          income_fees: number | null;
          income_other: number | null;
          income_pay: number | null;
          income_rates_hour: number | null;
          income_rates_mile: number | null;
          income_tips: number | null;
          income_total: number | null;
          income_total_charge: number | null;
          metadata: string | null;
          metadata_circumstances_is_pool: boolean | null;
          metadata_circumstances_is_rush: string | null;
          metadata_circumstances_is_surge: boolean | null;
          metadata_circumstances_service_type: string | null;
          metadata_origin_id: string | null;
          start_datetime: string | null;
          start_location: number | null;
          start_location_formatted_address: string | null;
          start_location_lat: string | null;
          start_location_lng: string | null;
          status: string | null;
          task_count: number | null;
          timezone: string | null;
          type: string | null;
          updated_at: string | null;
          user: string | null;
        };
        Insert: {
          account?: string | null;
          circumstances_is_pool?: string | null;
          circumstances_is_rush?: string | null;
          circumstances_is_surge?: string | null;
          circumstances_position?: number | null;
          circumstances_service_type?: string | null;
          created_at?: string | null;
          distance?: number | null;
          distance_unit?: string | null;
          duration?: number | null;
          earning_type?: string | null;
          employer?: string | null;
          end_datetime?: string | null;
          end_location?: number | null;
          end_location_formatted_address?: string | null;
          end_location_lat?: string | null;
          end_location_lng?: string | null;
          id: string;
          income_bonus?: number | null;
          income_currency?: string | null;
          income_fees?: number | null;
          income_other?: number | null;
          income_pay?: number | null;
          income_rates_hour?: number | null;
          income_rates_mile?: number | null;
          income_tips?: number | null;
          income_total?: number | null;
          income_total_charge?: number | null;
          metadata?: string | null;
          metadata_circumstances_is_pool?: boolean | null;
          metadata_circumstances_is_rush?: string | null;
          metadata_circumstances_is_surge?: boolean | null;
          metadata_circumstances_service_type?: string | null;
          metadata_origin_id?: string | null;
          start_datetime?: string | null;
          start_location?: number | null;
          start_location_formatted_address?: string | null;
          start_location_lat?: string | null;
          start_location_lng?: string | null;
          status?: string | null;
          task_count?: number | null;
          timezone?: string | null;
          type?: string | null;
          updated_at?: string | null;
          user?: string | null;
        };
        Update: {
          account?: string | null;
          circumstances_is_pool?: string | null;
          circumstances_is_rush?: string | null;
          circumstances_is_surge?: string | null;
          circumstances_position?: number | null;
          circumstances_service_type?: string | null;
          created_at?: string | null;
          distance?: number | null;
          distance_unit?: string | null;
          duration?: number | null;
          earning_type?: string | null;
          employer?: string | null;
          end_datetime?: string | null;
          end_location?: number | null;
          end_location_formatted_address?: string | null;
          end_location_lat?: string | null;
          end_location_lng?: string | null;
          id?: string;
          income_bonus?: number | null;
          income_currency?: string | null;
          income_fees?: number | null;
          income_other?: number | null;
          income_pay?: number | null;
          income_rates_hour?: number | null;
          income_rates_mile?: number | null;
          income_tips?: number | null;
          income_total?: number | null;
          income_total_charge?: number | null;
          metadata?: string | null;
          metadata_circumstances_is_pool?: boolean | null;
          metadata_circumstances_is_rush?: string | null;
          metadata_circumstances_is_surge?: boolean | null;
          metadata_circumstances_service_type?: string | null;
          metadata_origin_id?: string | null;
          start_datetime?: string | null;
          start_location?: number | null;
          start_location_formatted_address?: string | null;
          start_location_lat?: string | null;
          start_location_lng?: string | null;
          status?: string | null;
          task_count?: number | null;
          timezone?: string | null;
          type?: string | null;
          updated_at?: string | null;
          user?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'argyle_driver_activities_argyle_account_fkey';
            columns: ['account'];
            isOneToOne: false;
            referencedRelation: 'argyle_accounts';
            referencedColumns: ['argyle_account'];
          }
        ];
      };
      argyle_items: {
        Row: {
          id: string;
          name: string | null;
        };
        Insert: {
          id: string;
          name?: string | null;
        };
        Update: {
          id?: string;
          name?: string | null;
        };
        Relationships: [];
      };
      driver_affiliate_organization_affiliations: {
        Row: {
          affiliate_organization_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          affiliate_organization_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          affiliate_organization_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_affiliate_organization_af_affiliate_organization_id_fkey';
            columns: ['affiliate_organization_id'];
            isOneToOne: false;
            referencedRelation: 'affiliate_organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      driver_affiliate_organization_data_sharing_consents: {
        Row: {
          affiliate_organization_id: string;
          created_at: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          affiliate_organization_id: string;
          created_at?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          affiliate_organization_id?: string;
          created_at?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_affiliate_organization_da_affiliate_organization_id_fkey';
            columns: ['affiliate_organization_id'];
            isOneToOne: false;
            referencedRelation: 'affiliate_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_driver_affiliate_organization_data_sharing_consents_user_id';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          }
        ];
      };
      opt_out_survey_responses: {
        Row: {
          completed_survey: boolean;
          created_at: string;
          id: string;
          survey_comments: string | null;
          survey_left_reason: string | null;
          updated_at: string;
        };
        Insert: {
          completed_survey?: boolean;
          created_at?: string;
          id?: string;
          survey_comments?: string | null;
          survey_left_reason?: string | null;
          updated_at?: string;
        };
        Update: {
          completed_survey?: boolean;
          created_at?: string;
          id?: string;
          survey_comments?: string | null;
          survey_left_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizer_affiliate_organization_affiliations: {
        Row: {
          affiliate_organization_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          affiliate_organization_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          affiliate_organization_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organizer_affiliate_organization_affiliate_organization_id_fkey';
            columns: ['affiliate_organization_id'];
            isOneToOne: false;
            referencedRelation: 'affiliate_organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      organizer_affiliations_phone_whitelist: {
        Row: {
          affiliate_organization_id: string;
          created_at: string;
          phone_number: string;
        };
        Insert: {
          affiliate_organization_id: string;
          created_at?: string;
          phone_number: string;
        };
        Update: {
          affiliate_organization_id?: string;
          created_at?: string;
          phone_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organizer_affiliations_phone_whi_affiliate_organization_id_fkey';
            columns: ['affiliate_organization_id'];
            isOneToOne: false;
            referencedRelation: 'affiliate_organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      organizer_logging: {
        Row: {
          action: Database['public']['Enums']['organizer_log_action'];
          additional_data: Json | null;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          action: Database['public']['Enums']['organizer_log_action'];
          additional_data?: Json | null;
          created_at?: string;
          id: string;
          user_id: string;
        };
        Update: {
          action?: Database['public']['Enums']['organizer_log_action'];
          additional_data?: Json | null;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address: string | null;
          argyle_user: string | null;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          preferred_language: string | null;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          argyle_user?: string | null;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          preferred_language?: string | null;
          user_id: string;
        };
        Update: {
          address?: string | null;
          argyle_user?: string | null;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          preferred_language?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      received_argyle_webhooks: {
        Row: {
          created_at: string;
          id: string;
          received_at: string;
          response: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          received_at: string;
          response: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          received_at?: string;
          response?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      sms_messages: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          message: string;
          message_template_key: string;
          phone_number: string;
          scheduled_to_send_at: string;
          sent_to_twilio_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          message: string;
          message_template_key: string;
          phone_number: string;
          scheduled_to_send_at: string;
          sent_to_twilio_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          message?: string;
          message_template_key?: string;
          phone_number?: string;
          scheduled_to_send_at?: string;
          sent_to_twilio_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      study_participations: {
        Row: {
          created_at: string | null;
          id: string;
          post_sync: Database['public']['Enums']['study_participations_post_sync'];
          study_shortcode: Database['public']['Enums']['study_shortcode_type'];
          survey_response_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          post_sync?: Database['public']['Enums']['study_participations_post_sync'];
          study_shortcode: Database['public']['Enums']['study_shortcode_type'];
          survey_response_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          post_sync?: Database['public']['Enums']['study_participations_post_sync'];
          study_shortcode?: Database['public']['Enums']['study_shortcode_type'];
          survey_response_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_study_participations_profiles_user_id';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          }
        ];
      };
      survey_driver_demographics: {
        Row: {
          age: number | null;
          created_at: string;
          gender: string | null;
          gig_work_is: Database['public']['Enums']['gig_work_is_enum'] | null;
          id: number;
          in_the_last_12_months_skipped_meals:
            | Database['public']['Enums']['in_the_last_12_months_generic_frequency_enum']
            | null;
          in_the_last_12_months_skipped_medical_visits:
            | Database['public']['Enums']['in_the_last_12_months_generic_frequency_enum']
            | null;
          in_the_last_12_months_stuggled_to_pay_rent:
            | Database['public']['Enums']['in_the_last_12_months_number_of_times_enum']
            | null;
          in_the_last_12_months_stuggled_to_pay_utilities:
            | Database['public']['Enums']['in_the_last_12_months_number_of_times_enum']
            | null;
          in_the_last_12_months_taken_on_debt_for_expenses:
            | Database['public']['Enums']['in_the_last_12_months_generic_frequency_enum']
            | null;
          nationality: string | null;
          page_visited_at: string;
          sexual_orientation: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          age?: number | null;
          created_at?: string;
          gender?: string | null;
          gig_work_is?: Database['public']['Enums']['gig_work_is_enum'] | null;
          id?: number;
          in_the_last_12_months_skipped_meals?:
            | Database['public']['Enums']['in_the_last_12_months_generic_frequency_enum']
            | null;
          in_the_last_12_months_skipped_medical_visits?:
            | Database['public']['Enums']['in_the_last_12_months_generic_frequency_enum']
            | null;
          in_the_last_12_months_stuggled_to_pay_rent?:
            | Database['public']['Enums']['in_the_last_12_months_number_of_times_enum']
            | null;
          in_the_last_12_months_stuggled_to_pay_utilities?:
            | Database['public']['Enums']['in_the_last_12_months_number_of_times_enum']
            | null;
          in_the_last_12_months_taken_on_debt_for_expenses?:
            | Database['public']['Enums']['in_the_last_12_months_generic_frequency_enum']
            | null;
          nationality?: string | null;
          page_visited_at?: string;
          sexual_orientation?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          age?: number | null;
          created_at?: string;
          gender?: string | null;
          gig_work_is?: Database['public']['Enums']['gig_work_is_enum'] | null;
          id?: number;
          in_the_last_12_months_skipped_meals?:
            | Database['public']['Enums']['in_the_last_12_months_generic_frequency_enum']
            | null;
          in_the_last_12_months_skipped_medical_visits?:
            | Database['public']['Enums']['in_the_last_12_months_generic_frequency_enum']
            | null;
          in_the_last_12_months_stuggled_to_pay_rent?:
            | Database['public']['Enums']['in_the_last_12_months_number_of_times_enum']
            | null;
          in_the_last_12_months_stuggled_to_pay_utilities?:
            | Database['public']['Enums']['in_the_last_12_months_number_of_times_enum']
            | null;
          in_the_last_12_months_taken_on_debt_for_expenses?:
            | Database['public']['Enums']['in_the_last_12_months_generic_frequency_enum']
            | null;
          nationality?: string | null;
          page_visited_at?: string;
          sexual_orientation?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      survey_fair_take_rate: {
        Row: {
          average_take: number | null;
          consents_to_more_surveys: boolean | null;
          created_at: string | null;
          estimate: number | null;
          ethnicity: string | null;
          factors: string | null;
          fair: number | null;
          hours_per_week_of_gig_work:
            | Database['public']['Enums']['hours_per_week_of_gig_work_enum']
            | null;
          id: number;
          max_date: string | null;
          max_take: number | null;
          min_date: string | null;
          min_take: number | null;
          page_visited_at: string;
          updated_at: string | null;
          user_id: string;
          vehicle_ownership_status: string | null;
          what_you_think: string | null;
        };
        Insert: {
          average_take?: number | null;
          consents_to_more_surveys?: boolean | null;
          created_at?: string | null;
          estimate?: number | null;
          ethnicity?: string | null;
          factors?: string | null;
          fair?: number | null;
          hours_per_week_of_gig_work?:
            | Database['public']['Enums']['hours_per_week_of_gig_work_enum']
            | null;
          id?: number;
          max_date?: string | null;
          max_take?: number | null;
          min_date?: string | null;
          min_take?: number | null;
          page_visited_at?: string;
          updated_at?: string | null;
          user_id: string;
          vehicle_ownership_status?: string | null;
          what_you_think?: string | null;
        };
        Update: {
          average_take?: number | null;
          consents_to_more_surveys?: boolean | null;
          created_at?: string | null;
          estimate?: number | null;
          ethnicity?: string | null;
          factors?: string | null;
          fair?: number | null;
          hours_per_week_of_gig_work?:
            | Database['public']['Enums']['hours_per_week_of_gig_work_enum']
            | null;
          id?: number;
          max_date?: string | null;
          max_take?: number | null;
          min_date?: string | null;
          min_take?: number | null;
          page_visited_at?: string;
          updated_at?: string | null;
          user_id?: string;
          vehicle_ownership_status?: string | null;
          what_you_think?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          role: Database['public']['Enums']['user_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role: Database['public']['Enums']['user_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database['public']['Enums']['user_role'];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      affiliate_organization_status: 'active' | 'deleted';
      gig_work_is_enum: 'main_job' | 'main_job_but_has_other_jobs' | 'side_job';
      hours_per_week_of_gig_work_enum: '0-9' | '10-19' | '20-29' | '30-39' | '40-49' | '50+';
      in_the_last_12_months_generic_frequency_enum:
        | 'Not at all'
        | 'Rarely'
        | 'Sometimes'
        | 'Often'
        | 'Always';
      in_the_last_12_months_number_of_times_enum:
        | '0 times'
        | '1-2 times'
        | '3-6 times'
        | '7 or more times';
      organizer_log_action:
        | 'logged_in'
        | 'downloaded_user_data'
        | 'generated_user_report'
        | 'viewed_user_page';
      study_participations_post_sync: 'send-take-rate' | 'do-nothing' | 'send-thank-you';
      study_shortcode_type: 'edl';
      user_role: 'driver' | 'organizer';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'objects_bucketId_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          }
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          }
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_parts_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 's3_multipart_uploads_parts_upload_id_fkey';
            columns: ['upload_id'];
            isOneToOne: false;
            referencedRelation: 's3_multipart_uploads';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_insert_object: {
        Args: {
          bucketid: string;
          name: string;
          owner: string;
          metadata: Json;
        };
        Returns: undefined;
      };
      extension: {
        Args: {
          name: string;
        };
        Returns: string;
      };
      filename: {
        Args: {
          name: string;
        };
        Returns: string;
      };
      foldername: {
        Args: {
          name: string;
        };
        Returns: string[];
      };
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>;
        Returns: {
          size: number;
          bucket_id: string;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          prefix_param: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
        };
        Returns: {
          key: string;
          id: string;
          created_at: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string;
          prefix_param: string;
          delimiter_param: string;
          max_keys?: number;
          start_after?: string;
          next_token?: string;
        };
        Returns: {
          name: string;
          id: string;
          metadata: Json;
          updated_at: string;
        }[];
      };
      operation: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      search: {
        Args: {
          prefix: string;
          bucketname: string;
          limits?: number;
          levels?: number;
          offsets?: number;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          name: string;
          id: string;
          updated_at: string;
          created_at: string;
          last_accessed_at: string;
          metadata: Json;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
    ? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;
