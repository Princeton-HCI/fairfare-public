import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_KEY } from '$env/static/private';
import { PUB_VITE_SUPABASE_URL } from '$env/static/public';

/**
 * A service-role client that never picks up a session.
 *
 * Use this one in a test that also signs a user in: with session persistence on,
 * the shared client ends up acting as that user instead of as the service role,
 * which quietly turns an RLS assertion into a test of the wrong actor. For
 * plain fixture setup, `createSupabaseClient` in tests/utils/testUser.ts is the
 * equivalent with an explicit Authorization header. Playwright specs use
 * `createPlaywrightSupabaseClient`, which reads process.env instead of `$env`.
 */
export default () => {
  return createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
};
