import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_KEY } from '$env/static/private';
import { PUB_VITE_SUPABASE_URL } from '$env/static/public';

export default () => {
  // re-generate the client with the service role; this is necessary since if
  // we log in a user with the service role, the client then be logged in
  // as that user instead of with the service role.
  return createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
};
