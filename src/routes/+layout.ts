import { PUB_VITE_SUPABASE_ANON_KEY, PUB_VITE_SUPABASE_URL } from '$env/static/public';
import type { LayoutLoad } from './$types';
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { wrapLoadWithSentry } from '@sentry/sveltekit';

export const load: LayoutLoad = wrapLoadWithSentry(async ({ fetch, data, depends }) => {
  depends('supabase:auth');

  const supabase = isBrowser()
    ? createBrowserClient(PUB_VITE_SUPABASE_URL, PUB_VITE_SUPABASE_ANON_KEY, {
        global: {
          fetch
        }
      })
    : createServerClient(PUB_VITE_SUPABASE_URL, PUB_VITE_SUPABASE_ANON_KEY, {
        global: {
          fetch
        },
        cookies: {
          getAll() {
            return data.cookies;
          }
        }
      });

  /**
   * It's fine to use `getSession` here, because on the client, `getSession` is
   * safe, and on the server, it reads `session` from the `LayoutData`, which
   * safely checked the session using `safeGetSession`.
   */
  const {
    data: { session }
  } = await supabase.auth.getSession();

  return { ...data, supabase, session };
});
