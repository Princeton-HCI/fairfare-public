import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_SERVICE_KEY } from '$env/static/private';
import { PUB_VITE_SUPABASE_URL } from '$env/static/public';

/**
 * Create a supabase client for the server
 */

// see: https://github.com/supabase/auth-helpers/issues/598
export const supabase = createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  },
  global: {
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  }
});

class db {
  supabase: SupabaseClient;
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }
}

export default new db(supabase);
