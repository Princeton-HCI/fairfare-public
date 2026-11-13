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
      admin_activity_log: {
        Row: {
          action: string;
          admin_email: string | null;
          admin_user_id: string;
          created_at: string;
          id: string;
          metadata: Json | null;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          admin_email?: string | null;
          admin_user_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          admin_email?: string | null;
          admin_user_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [];
      };
      affiliate_organizations: {
        Row: {
          created_at: string;
          data_deletion_contact_email: string | null;
          driver_signup_code: string | null;
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
          data_deletion_contact_email?: string | null;
          driver_signup_code?: string | null;
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
          data_deletion_contact_email?: string | null;
          driver_signup_code?: string | null;
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
          all_gigs_last_sync_attempt_message: string | null;
          all_gigs_last_sync_attempt_status:
            | Database['public']['Enums']['argyle_sync_status']
            | null;
          all_gigs_last_sync_attempted_at: string | null;
          all_gigs_last_synced_at: string | null;
          argyle_account: string;
          argyle_user: string;
          created_at: string;
          deleted_at: string | null;
          employer: string | null;
          id: string;
          organization_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          all_gigs_last_sync_attempt_message?: string | null;
          all_gigs_last_sync_attempt_status?:
            | Database['public']['Enums']['argyle_sync_status']
            | null;
          all_gigs_last_sync_attempted_at?: string | null;
          all_gigs_last_synced_at?: string | null;
          argyle_account: string;
          argyle_user: string;
          created_at?: string;
          deleted_at?: string | null;
          employer?: string | null;
          id?: string;
          organization_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          all_gigs_last_sync_attempt_message?: string | null;
          all_gigs_last_sync_attempt_status?:
            | Database['public']['Enums']['argyle_sync_status']
            | null;
          all_gigs_last_sync_attempted_at?: string | null;
          all_gigs_last_synced_at?: string | null;
          argyle_account?: string;
          argyle_user?: string;
          created_at?: string;
          deleted_at?: string | null;
          employer?: string | null;
          id?: string;
          organization_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'argyle_accounts_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'affiliate_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_argyle_accounts_profiles_user_id';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          }
        ];
      };
      argyle_accounts_export: {
        Row: {
          account: Json;
          argyle_account: string;
          argyle_created_at: string | null;
          argyle_updated_at: string | null;
          argyle_user: string | null;
          connection_error_code: string | null;
          connection_error_message: string | null;
          connection_status: string | null;
          connection_updated_at: string | null;
          employers: string[] | null;
          exported_at: string;
          id: string;
        };
        Insert: {
          account: Json;
          argyle_account: string;
          argyle_created_at?: string | null;
          argyle_updated_at?: string | null;
          argyle_user?: string | null;
          connection_error_code?: string | null;
          connection_error_message?: string | null;
          connection_status?: string | null;
          connection_updated_at?: string | null;
          employers?: string[] | null;
          exported_at?: string;
          id?: string;
        };
        Update: {
          account?: Json;
          argyle_account?: string;
          argyle_created_at?: string | null;
          argyle_updated_at?: string | null;
          argyle_user?: string | null;
          connection_error_code?: string | null;
          connection_error_message?: string | null;
          connection_status?: string | null;
          connection_updated_at?: string | null;
          employers?: string[] | null;
          exported_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      argyle_driver_activities: {
        Row: {
          account: string | null;
          account_id: string | null;
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
          ride_hash: string;
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
          account_id?: string | null;
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
          ride_hash: string;
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
          account_id?: string | null;
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
          ride_hash?: string;
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
            foreignKeyName: 'argyle_driver_activities_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'argyle_accounts';
            referencedColumns: ['id'];
          }
        ];
      };
      argyle_error_accounts: {
        Row: {
          address: string | null;
          affiliate_organization: string | null;
          argyle_account: string;
          argyle_created_at: string | null;
          argyle_updated_at: string | null;
          argyle_user: string;
          email: string | null;
          employer: string | null;
          error_code: string | null;
          first_name: string | null;
          id: string;
          last_initial: string | null;
          phone: string | null;
          status: string | null;
          user_id: string | null;
        };
        Insert: {
          address?: string | null;
          affiliate_organization?: string | null;
          argyle_account: string;
          argyle_created_at?: string | null;
          argyle_updated_at?: string | null;
          argyle_user: string;
          email?: string | null;
          employer?: string | null;
          error_code?: string | null;
          first_name?: string | null;
          id?: string;
          last_initial?: string | null;
          phone?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Update: {
          address?: string | null;
          affiliate_organization?: string | null;
          argyle_account?: string;
          argyle_created_at?: string | null;
          argyle_updated_at?: string | null;
          argyle_user?: string;
          email?: string | null;
          employer?: string | null;
          error_code?: string | null;
          first_name?: string | null;
          id?: string;
          last_initial?: string | null;
          phone?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
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
          is_primary: boolean;
          user_id: string;
        };
        Insert: {
          affiliate_organization_id: string;
          created_at?: string;
          is_primary?: boolean;
          user_id: string;
        };
        Update: {
          affiliate_organization_id?: string;
          created_at?: string;
          is_primary?: boolean;
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
      driver_data_downloads_by_organizers: {
        Row: {
          affiliate_organization_id: string;
          created_at: string;
          downloaded_user_data_id: string;
          downloading_user_id: string;
          end_date: string | null;
          id: string;
          includes_pdf: boolean;
          selected_employer: string | null;
          start_date: string | null;
        };
        Insert: {
          affiliate_organization_id: string;
          created_at?: string;
          downloaded_user_data_id: string;
          downloading_user_id: string;
          end_date?: string | null;
          id?: string;
          includes_pdf: boolean;
          selected_employer?: string | null;
          start_date?: string | null;
        };
        Update: {
          affiliate_organization_id?: string;
          created_at?: string;
          downloaded_user_data_id?: string;
          downloading_user_id?: string;
          end_date?: string | null;
          id?: string;
          includes_pdf?: boolean;
          selected_employer?: string | null;
          start_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_data_downloads_by_organiz_affiliate_organization_id_fkey';
            columns: ['affiliate_organization_id'];
            isOneToOne: false;
            referencedRelation: 'affiliate_organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      driver_signup_code_attempts: {
        Row: {
          attempted_at: string;
          id: string;
          ip_address: string;
          organization_id: string;
        };
        Insert: {
          attempted_at?: string;
          id?: string;
          ip_address: string;
          organization_id: string;
        };
        Update: {
          attempted_at?: string;
          id?: string;
          ip_address?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_signup_code_attempts_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'affiliate_organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      emails: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          message_id: string | null;
          status: string;
          subject: string;
          to: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          message_id?: string | null;
          status: string;
          subject: string;
          to: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          message_id?: string | null;
          status?: string;
          subject?: string;
          to?: string;
        };
        Relationships: [];
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
      organization_argyle_configs: {
        Row: {
          api_key_id: string;
          api_key_secret: string;
          argyle_webhook_subscription_id: string | null;
          created_at: string;
          flow_id: string | null;
          id: string;
          is_active: boolean;
          link_url: string;
          max_argyle_accounts: number | null;
          organization_id: string;
          updated_at: string;
          webhook_secret: string;
        };
        Insert: {
          api_key_id: string;
          api_key_secret: string;
          argyle_webhook_subscription_id?: string | null;
          created_at?: string;
          flow_id?: string | null;
          id?: string;
          is_active?: boolean;
          link_url: string;
          max_argyle_accounts?: number | null;
          organization_id: string;
          updated_at?: string;
          webhook_secret: string;
        };
        Update: {
          api_key_id?: string;
          api_key_secret?: string;
          argyle_webhook_subscription_id?: string | null;
          created_at?: string;
          flow_id?: string | null;
          id?: string;
          is_active?: boolean;
          link_url?: string;
          max_argyle_accounts?: number | null;
          organization_id?: string;
          updated_at?: string;
          webhook_secret?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_argyle_configs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: true;
            referencedRelation: 'affiliate_organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          created_by: string | null;
          organization_id: string;
          role: Database['public']['Enums']['organization_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          organization_id: string;
          role?: Database['public']['Enums']['organization_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          organization_id?: string;
          role?: Database['public']['Enums']['organization_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey';
            columns: ['organization_id'];
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
          invited_role: Database['public']['Enums']['organization_role'];
          phone_number: string;
        };
        Insert: {
          affiliate_organization_id: string;
          created_at?: string;
          invited_role?: Database['public']['Enums']['organization_role'];
          phone_number: string;
        };
        Update: {
          affiliate_organization_id?: string;
          created_at?: string;
          invited_role?: Database['public']['Enums']['organization_role'];
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
      organizer_membership_alerts: {
        Row: {
          abandoned_at: string | null;
          attempts: number;
          available_at: string;
          claim_token: string | null;
          created_at: string;
          id: string;
          last_error: string | null;
          organization_key: string;
          phone: string;
          role: Database['public']['Enums']['organization_role'];
          sent_at: string | null;
          source: string;
          user_id: string;
        };
        Insert: {
          abandoned_at?: string | null;
          attempts?: number;
          available_at?: string;
          claim_token?: string | null;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          organization_key: string;
          phone: string;
          role: Database['public']['Enums']['organization_role'];
          sent_at?: string | null;
          source: string;
          user_id: string;
        };
        Update: {
          abandoned_at?: string | null;
          attempts?: number;
          available_at?: string;
          claim_token?: string | null;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          organization_key?: string;
          phone?: string;
          role?: Database['public']['Enums']['organization_role'];
          sent_at?: string | null;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      policy_analysis_exports: {
        Row: {
          chunk_count: number;
          completed_at: string | null;
          created_at: string;
          cursor_id: string | null;
          cursor_start_datetime: string | null;
          error_message: string | null;
          file_path: string | null;
          filters: Json;
          id: string;
          organization_key: string;
          read_at: string | null;
          status: string;
          total_rows: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chunk_count?: number;
          completed_at?: string | null;
          created_at?: string;
          cursor_id?: string | null;
          cursor_start_datetime?: string | null;
          error_message?: string | null;
          file_path?: string | null;
          filters: Json;
          id?: string;
          organization_key: string;
          read_at?: string | null;
          status?: string;
          total_rows?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chunk_count?: number;
          completed_at?: string | null;
          created_at?: string;
          cursor_id?: string | null;
          cursor_start_datetime?: string | null;
          error_message?: string | null;
          file_path?: string | null;
          filters?: Json;
          id?: string;
          organization_key?: string;
          read_at?: string | null;
          status?: string;
          total_rows?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      policy_analysis_refresh_status: {
        Row: {
          is_singleton: boolean;
          last_refreshed_at: string;
        };
        Insert: {
          is_singleton?: boolean;
          last_refreshed_at: string;
        };
        Update: {
          is_singleton?: boolean;
          last_refreshed_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address: string | null;
          argyle_user: string | null;
          email: string | null;
          first_name: string | null;
          last_initial: string | null;
          last_sign_in_at: string | null;
          phone: string | null;
          preferred_language: string | null;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          argyle_user?: string | null;
          email?: string | null;
          first_name?: string | null;
          last_initial?: string | null;
          last_sign_in_at?: string | null;
          phone?: string | null;
          preferred_language?: string | null;
          user_id: string;
        };
        Update: {
          address?: string | null;
          argyle_user?: string | null;
          email?: string | null;
          first_name?: string | null;
          last_initial?: string | null;
          last_sign_in_at?: string | null;
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
      admin_audit_events: {
        Row: {
          action: string | null;
          actor_email: string | null;
          actor_id: string | null;
          at: string | null;
          detail: Json | null;
          id: string | null;
          source: string | null;
          target: string | null;
        };
        Relationships: [];
      };
      daily_driver_stats: {
        Row: {
          daily_trips: number | null;
          employer: string | null;
          end_state: string | null;
          start_state: string | null;
          stats_date: string | null;
          sum_charges: number | null;
          sum_distance: number | null;
          sum_duration: number | null;
          sum_pay: number | null;
          sum_tips: number | null;
          user: string | null;
        };
        Relationships: [];
      };
      organizer_affiliate_organization_affiliations: {
        Row: {
          affiliate_organization_id: string | null;
          created_at: string | null;
          user_id: string | null;
        };
        Insert: {
          affiliate_organization_id?: string | null;
          created_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          affiliate_organization_id?: string | null;
          created_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey';
            columns: ['affiliate_organization_id'];
            isOneToOne: false;
            referencedRelation: 'affiliate_organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      organizer_daily_stats: {
        Row: {
          employer: string | null;
          end_state: string | null;
          organizer_id: string | null;
          start_state: string | null;
          stats_date: string | null;
          total_charges: number | null;
          total_distance: number | null;
          total_drivers: number | null;
          total_duration: number | null;
          total_pay: number | null;
          total_tips: number | null;
          total_trips: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_organizer_membership_alerts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          abandoned_at: string | null;
          attempts: number;
          available_at: string;
          claim_token: string | null;
          created_at: string;
          id: string;
          last_error: string | null;
          organization_key: string;
          phone: string;
          role: Database['public']['Enums']['organization_role'];
          sent_at: string | null;
          source: string;
          user_id: string;
        }[];
      };
      connect_argyle_account_with_capacity: {
        Args: {
          p_user_id: string;
          p_argyle_user: string;
          p_argyle_account: string;
          p_organization_id: string;
        };
        Returns: Json;
      };
      generate_ride_hash: {
        Args: {
          p_user: string;
          p_start_datetime: string;
          p_end_datetime: string;
          p_start_location_lat: string;
          p_start_location_lng: string;
          p_end_location_lat: string;
          p_end_location_lng: string;
          p_income_total: number;
        };
        Returns: string;
      };
      generate_ride_hash_string_double_bar_concatenation: {
        Args: {
          user_id: string;
          start_datetime: string;
          end_datetime: string;
          start_location_lat: string;
          start_location_lng: string;
          end_location_lat: string;
          end_location_lng: string;
          income_total: number;
        };
        Returns: string;
      };
      get_policy_analysis_aggregates: {
        Args: {
          p_start_date?: string;
          p_end_date?: string;
          p_location?: string;
          p_driver_ids?: string[];
        };
        Returns: {
          total_drivers: number;
          total_trips: number;
          avg_distance_per_trip: number;
          avg_charge_per_trip: number;
          avg_charge_per_trip_no_tip: number;
          avg_hourly_rate: number;
          avg_hourly_rate_no_tip: number;
          avg_driver_pay_per_trip: number;
          avg_driver_pay_per_trip_no_tip: number;
        }[];
      };
      get_policy_analysis_csv_rows: {
        Args: {
          p_start_date?: string;
          p_end_date?: string;
          p_start_location?: string;
          p_end_location?: string;
          p_location_and?: boolean;
          p_platforms?: string[];
          p_driver_ids?: string[];
          p_limit?: number;
          p_cursor_start_datetime?: string;
          p_cursor_id?: string;
        };
        Returns: {
          employer: string;
          status: string;
          timezone: string;
          start_datetime: string;
          end_datetime: string;
          duration: number;
          start_location_lat: string;
          start_location_lng: string;
          start_location_formatted_address: string;
          end_location_lat: string;
          end_location_lng: string;
          end_location_formatted_address: string;
          distance: number;
          distance_unit: string;
          circumstances_is_surge: string;
          income_total_charge: number;
          income_pay: number;
          income_total: number;
          income_bonus: number;
          income_tips: number;
          income_fees: number;
          id: string;
        }[];
      };
      get_policy_analysis_stats: {
        Args: {
          in_start_date?: string;
          in_end_date?: string;
          in_employers?: string[];
          in_start_state?: string;
          in_end_state?: string;
          in_match_all_states?: boolean;
          in_driver_ids?: string[];
        };
        Returns: {
          total_trips: number;
          avg_distance: number;
          avg_charge: number;
          avg_charge_no_tip: number;
          avg_hourly_rate: number;
          avg_hourly_rate_no_tip: number;
          avg_pay: number;
          avg_pay_no_tip: number;
        }[];
      };
      get_policy_analysis_stats_aggregate: {
        Args: {
          in_start_date?: string;
          in_end_date?: string;
          in_employers?: string;
          in_start_state?: string;
          in_end_state?: string;
          in_match_all_states?: boolean;
        };
        Returns: {
          total_trips: number;
          avg_distance: number;
          avg_charge: number;
          avg_charge_no_tip: number;
          avg_hourly_rate: number;
          avg_hourly_rate_no_tip: number;
          avg_pay: number;
          avg_pay_no_tip: number;
        }[];
      };
      get_policy_analysis_stats_batch: {
        Args: {
          in_start_date?: string;
          in_end_date?: string;
          in_employers?: string[];
          in_start_state?: string;
          in_end_state?: string;
          in_match_all_states?: boolean;
          in_driver_ids?: string[];
          in_cursor_start_datetime?: string;
          in_cursor_id?: string;
          in_batch_size?: number;
        };
        Returns: {
          batch_trips: number;
          sum_distance: number;
          sum_charges: number;
          sum_pay: number;
          sum_tips: number;
          sum_duration: number;
          next_cursor_start_datetime: string;
          next_cursor_id: string;
          has_more: boolean;
        }[];
      };
      get_sick_time_stats: {
        Args: {
          in_driver_id?: string;
          in_start_date?: string;
          in_end_date?: string;
          in_rate_start_date?: string;
          in_rate_end_date?: string;
          in_employers?: string[];
          in_start_state?: string;
          in_end_state?: string;
          in_match_all_states?: boolean;
        };
        Returns: {
          trips_accrual: number;
          trips_rate: number;
          trips_total: number;
          total_earned_hours: number;
          hourly_rate: number;
          accrual_start_date: string;
          accrual_end_date: string;
          rate_start_date: string;
          rate_end_date: string;
        }[];
      };
      gtrgm_compress: {
        Args: {
          '': unknown;
        };
        Returns: unknown;
      };
      gtrgm_decompress: {
        Args: {
          '': unknown;
        };
        Returns: unknown;
      };
      gtrgm_in: {
        Args: {
          '': unknown;
        };
        Returns: unknown;
      };
      gtrgm_options: {
        Args: {
          '': unknown;
        };
        Returns: undefined;
      };
      gtrgm_out: {
        Args: {
          '': unknown;
        };
        Returns: unknown;
      };
      has_org_role: {
        Args: {
          p_org_id: string;
          p_min: Database['public']['Enums']['organization_role'];
        };
        Returns: boolean;
      };
      has_platform_role: {
        Args: {
          p_role: Database['public']['Enums']['user_role'];
        };
        Returns: boolean;
      };
      invite_organization_member: {
        Args: {
          p_organization_id: string;
          p_phone: string;
          p_role?: Database['public']['Enums']['organization_role'];
        };
        Returns: undefined;
      };
      join_organization_from_invite: {
        Args: {
          p_user_id: string;
          p_organization_id: string;
        };
        Returns: undefined;
      };
      membership_guard_bypassed: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      organization_role_rank: {
        Args: {
          p_role: Database['public']['Enums']['organization_role'];
        };
        Returns: number;
      };
      refresh_policy_analysis_views: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      remove_organization_member: {
        Args: {
          p_organization_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      revoke_organization_invite: {
        Args: {
          p_organization_id: string;
          p_phone: string;
        };
        Returns: undefined;
      };
      set_limit: {
        Args: {
          '': number;
        };
        Returns: number;
      };
      set_organization_member_role: {
        Args: {
          p_organization_id: string;
          p_user_id: string;
          p_role: Database['public']['Enums']['organization_role'];
        };
        Returns: undefined;
      };
      show_limit: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      show_trgm: {
        Args: {
          '': string;
        };
        Returns: string[];
      };
      stop_sharing_primary: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      affiliate_organization_status: 'active' | 'deleted';
      argyle_sync_status:
        | 'success'
        | 'argyle_failure'
        | 'deletion_blocked_by_existing_activities'
        | 'system_failure'
        | 'unknown';
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
      organization_role: 'organizer' | 'lead_organizer';
      organizer_log_action:
        | 'logged_in'
        | 'downloaded_user_data'
        | 'generated_user_report'
        | 'viewed_user_page'
        | 'invited_member'
        | 'member_joined'
        | 'member_role_changed'
        | 'member_removed'
        | 'removed_driver';
      study_participations_post_sync: 'send-take-rate' | 'do-nothing' | 'send-thank-you';
      study_shortcode_type: 'edl' | 'rtk';
      user_role: 'driver' | 'organizer' | 'researcher' | 'admin';
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
