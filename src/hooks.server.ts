import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { PUB_VITE_SUPABASE_ANON_KEY, PUB_VITE_SUPABASE_URL } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { config } from 'dotenv';
import { getProfileFromUserId } from './lib/databaseHelpers';

const getEnvironment = (): string => {
  config(); // Load env vars

  const netlifySiteName = process.env.SITE_NAME;
  const netlifySiteId = process.env.SITE_ID;
  const netlifyDeployUrl = process.env.URL;

  if (!netlifySiteName || !netlifySiteId || !netlifyDeployUrl) {
    return 'development';
  }

  // FIXME: improve this, see: https://docs.netlify.com/functions/environment-variables/
  return 'production';
};

Sentry.init({
  // CONTEXT is from Netlify's build metadata: https://docs.netlify.com/configure-builds/environment-variables/#build-metadata
  // MODE is from Vite's build metadata: https://vitejs.dev/guide/env-and-mode.html#modes
  environment: getEnvironment(),
  dsn: 'https://3f41c01122e43d8dfa35db144809967c@o4506775983947776.ingest.us.sentry.io/4508320236437504',
  tracesSampleRate: 1
});

export const handle: Handle = sequence(Sentry.sentryHandle(), async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(PUB_VITE_SUPABASE_URL, PUB_VITE_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return event.cookies.getAll();
      },
      setAll(cookiesToSet) {
        /**
         * Note: You have to add the `path` variable to the
         * set and remove method due to sveltekit's cookie API
         * requiring this to be set, setting the path to an empty string
         * will replicate previous/standard behavior (https://kit.svelte.dev/docs/types#public-types-cookies)
         */
        cookiesToSet.forEach(({ name, value, options }) =>
          event.cookies.set(name, value, { ...options, path: '/' })
        );
      }
    }
  });

  /**
   * Unlike `supabase.auth.getSession()`, which returns the session _without_
   * validating the JWT, this function also calls `getUser()` to validate the
   * JWT before returning the session.
   */
  event.locals.safeGetSession = async () => {
    // TODO: look run these queries in parallel to speed up the response
    const {
      data: { session }
    } = await event.locals.supabase.auth.getSession();
    if (!session) {
      return { session: null, user: null, profile: null };
    }

    const {
      data: { user },
      error
    } = await event.locals.supabase.auth.getUser();
    if (error || !user) {
      // JWT validation has failed
      return { session: null, user: null, profile: null };
    }

    // Get the user's profile as well
    const profile = await getProfileFromUserId(event.locals.supabase, user.id);

    return { session, user, profile };
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });
});
export const handleError = Sentry.handleErrorWithSentry();
