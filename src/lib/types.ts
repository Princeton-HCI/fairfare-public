import type { Database } from '$lib/schema';

export type ArgyleAccountData = {
  accountId: string;
  userId: string;
  itemId: string;
};

// Easier export of Supabase schema
declare global {
  export type SupabaseRows = {
    [TableName in keyof Database['public']['Tables']]: Database['public']['Tables'][TableName]['Row'];
  };
  export type SupabaseInserts = {
    [TableName in keyof Database['public']['Tables']]: Database['public']['Tables'][TableName]['Insert'];
  };
  export type SupabaseViews = {
    [TableName in keyof Database['public']['Views']]: Database['public']['Views'][TableName]['Row'];
  };
  export type SupabaseEnums = {
    [TableName in keyof Database['public']['Enums']]: Database['public']['Enums'][TableName];
  };
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Argyle: any;
  }
}

/** ARGYLE TYPES **/
interface Address {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface ArgyleIdentity {
  id: string;
  account: string;
  address: Address;
  first_name: string;
  last_name: string;
  full_name: string;
  birth_date: string;
  email: string;
  phone_number: string;
  picture_url: string;
  employment_status: string;
  employment_type: string;
  job_title: string | null;
  ssn: string;
  marital_status: string;
  gender: string;
  hire_date: string;
  termination_date: string;
  termination_reason: string | null;
  employer: string;
  // base_pay: BasePay;
  pay_cycle: string;
  // platform_ids: PlatformIds;
  created_at: string;
  updated_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>; // Assuming metadata is an object with dynamic properties
}

export interface ArgyleAccountResponse {
  id: string;
  user: string;
  employers: string[];
  item: string;
  source: string;
  created_at: string;
  updated_at: string;
  scanned_at: string;
  connection: {
    status: string;
    error_code: null | string;
    error_message: null | string;
    updated_at: string;
  };
  direct_deposit_switch: {
    status: string;
    error_code: null | string;
    error_message: null | string;
    updated_at: string;
  };
  availability: {
    gigs: {
      status: string;
      updated_at: string;
      available_count: number;
      available_from: string;
      available_to: string;
    };
    shifts: {
      status: string;
      updated_at: string;
      available_count: number;
      available_from: null | string;
      available_to: null | string;
    };
    paystubs: {
      status: string;
      updated_at: string;
      available_count: number;
      available_from: string;
      available_to: string;
    };
    payroll_documents: {
      status: string;
      updated_at: string;
    };
    identities: {
      status: string;
      updated_at: string;
    };
    ratings: {
      status: string;
      updated_at: string;
    };
    vehicles: {
      status: string;
      updated_at: string;
    };
    deposit_destinations: {
      status: string;
      updated_at: string;
    };
    user_forms: null;
    user_uploads: null;
  };
  ongoing_refresh: {
    status: string;
  };
}

export interface ArgyleIdentitiesResponse {
  results: ArgyleIdentity[];
  next: null | string;
  previous: null | string;
}

interface ArgyleGig {
  id: string;
  account: string;
  employer: string;
  created_at: string;
  updated_at: string;
  status: 'completed' | string;
  type: 'delivery' | string;
  task_count: number;
  start_datetime: string;
  end_datetime: string;
  all_datetimes: {
    request_at: string;
    accept_at: string;
    pickup_at: string;
    dropoff_at: string;
    cancel_at: null | string;
    shift_start: null | string;
    shift_end: null | string;
    breaks: {
      break_start: null | string;
      break_end: null | string;
    }[];
  };
  duration: number;
  timezone: string;
  earning_type: 'work' | string;
  start_location: {
    lat: string;
    lng: string;
    formatted_address: string;
  };
  end_location: {
    lat: string;
    lng: string;
    formatted_address: string;
  };
  task_details: {
    events: Array<{
      order_id: string | null;
      sequence: string;
      type: 'accept' | 'pickup' | 'dropoff' | string;
      name: string | null;
      formatted_address: string;
      lat: string;
      lng: string;
      datetime: string;
    }>;
    orders: Array<{
      order_id: string;
      sequence: string;
      income: {
        currency: string;
        total_charge: string;
        customer_price: string;
        fees: string | null;
        total: string;
        pay: string;
        tips: string | null;
        bonus: string;
        other: string | null;
      };
    }>;
  };
  distance: string;
  distance_unit: string;
  metadata: {
    [key: string]: {
      name: string;
      value: string;
    };
  };
  circumstances: {
    is_pool: boolean;
    is_rush: boolean;
    is_surge: boolean;
    service_type: string;
    position: null | string;
  };
  income: {
    currency: string;
    total_charge: string;
    customer_price: string;
    fees: string;
    total: string;
    pay: string;
    tips: string;
    bonus: string;
    other: string;
  };
  income_rates: {
    hour: string;
    mile: string;
  };
}

export interface ArgyleGigsResponse {
  results: ArgyleGig[];
  next: null | string;
  previous: null | string;
}
