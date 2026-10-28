import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { PUB_VITE_SUPABASE_ANON_KEY, PUB_VITE_SUPABASE_URL } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { config } from 'dotenv';
import { getProfileFromUserId } from './lib/databaseHelpers';
import { emptyAuthContext } from './lib/rbac';
import { loadAuthContext } from './lib/server/rbac';

type SafeSession = Awaited<ReturnType<App.Locals['safeGetSession']>>;

const isProduction = (): boolean => {
  config(); // Load env vars

  // See: https://docs.netlify.com/configure-builds/environment-variables/#build-metadata
  const url = process.env.URL ?? '';
  return (
    process.env.CONTEXT === 'production' &&
    url.includes('getsystem.org') &&
    !url.includes('staging.')
  );
};

const environment = isProduction() ? 'production' : 'development';

Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  environment,
  enabled: environment === 'production',
  ignoreErrors: ['NetworkError', 'Failed to fetch', 'Load failed', 'AbortError'],
  beforeSend(event) {
    return event.exception ? event : null;
  }
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
   * Memoized per request, keyed on the access token. A single page render calls
   * `safeGetSession` from the root layout, any nested layouts, and the page
   * load — without this, each of those repeats `getUser()`, the profile lookup,
   * and the three role queries behind `loadAuthContext`. Keying on the token
   * rather than caching unconditionally keeps a sign-in or sign-out that
   * happens mid-request from being served a stale context.
   */
  let cachedSession: { accessToken: string; value: SafeSession } | null = null;

  /**
   * Unlike `supabase.auth.getSession()`, which returns the session _without_
   * validating the JWT, this function also calls `getUser()` to validate the
   * JWT before returning the session.
   */
  event.locals.safeGetSession = async () => {
    // `getSession()` reads the cookie locally, so this stays cheap on a hit.
    const {
      data: { session }
    } = await event.locals.supabase.auth.getSession();
    if (!session) {
      cachedSession = null;
      return { session: null, user: null, profile: null, roles: emptyAuthContext() };
    }

    if (cachedSession?.accessToken === session.access_token) {
      return cachedSession.value;
    }

    const {
      data: { user },
      error
    } = await event.locals.supabase.auth.getUser();
    if (error || !user) {
      // JWT validation has failed
      cachedSession = null;
      return { session: null, user: null, profile: null, roles: emptyAuthContext() };
    }

    // Get the user's profile as well. A missing profile must not 500 the request —
    // role checks still run from user_roles / organization_members.
    const [profile, roles] = await Promise.all([
      getProfileFromUserId(event.locals.supabase, user.id).catch((error) => {
        console.error('Failed to load profile for session', error);
        return null;
      }),
      loadAuthContext(event.locals.supabase, user.id)
    ]);

    const value = { session, user, profile, roles };
    cachedSession = { accessToken: session.access_token, value };
    return value;
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });
});
export const handleError = Sentry.handleErrorWithSentry();
