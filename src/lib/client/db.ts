import { PUB_VITE_SUPABASE_ANON_KEY, PUB_VITE_SUPABASE_URL } from '$env/static/public';
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(PUB_VITE_SUPABASE_URL, PUB_VITE_SUPABASE_ANON_KEY, {
  global: {
    fetch
  }
});
