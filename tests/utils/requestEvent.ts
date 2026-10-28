/**
 * Builders for the fake `RequestEvent` objects that endpoint specs hand to a
 * `+server.ts` handler.
 *
 * Four specs each had their own private `createMockRequestEvent` that differed
 * only in the URL; anything an endpoint spec needs to fake belongs here instead,
 * so that a change to `locals` is one edit rather than a search.
 *
 * Handlers written as Netlify functions take a differently-typed event; those
 * specs cast the result: `POST(createInternalRequestEvent(url) as unknown as HandlerEvent)`.
 */

import type { RequestEvent } from '@sveltejs/kit';
import type { AuthContext } from '@src/lib/rbac';

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

const buildRequest = (url: string, options: RequestOptions = {}): Request => {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  return new Request(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
};

/** A bare event: just the request, for handlers that only read `event.request`. */
export function createRequestEvent(url: string, options: RequestOptions = {}): RequestEvent {
  return {
    request: buildRequest(url, options),
    url: new URL(url)
  } as unknown as RequestEvent;
}

/**
 * An event carrying the internal API secret, for the cron-style endpoints that
 * authenticate with `Authorization: Bearer $INTERNAL_API_SECRET`.
 */
export function createInternalRequestEvent(
  url: string,
  options: RequestOptions = {}
): RequestEvent {
  return createRequestEvent(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`
    }
  });
}

/**
 * An event for an authenticated user, with `locals.supabase.auth.getUser()` and
 * `locals.safeGetSession()` both resolving to that user.
 *
 * `roles` defaults to platform admin: cross-org exports (selectedScope=all) need
 * platform:export_cross_org_data, which only admins hold — researchers can view
 * aggregates but not export. Pass `roles` explicitly to test a narrower actor.
 */
export function createAuthenticatedRequestEvent(
  url: string,
  options: RequestOptions & { userId: string; roles?: AuthContext }
): RequestEvent {
  return {
    request: buildRequest(url, options),
    url: new URL(url),
    locals: {
      supabase: {
        auth: {
          getUser: () =>
            Promise.resolve({
              data: { user: { id: options.userId } },
              error: null
            })
        }
      },
      safeGetSession: () =>
        Promise.resolve({
          session: { access_token: 'x' },
          user: { id: options.userId },
          profile: null,
          roles: options.roles ?? {
            userId: options.userId,
            platformRole: 'admin',
            orgRoles: {}
          }
        })
    }
  } as unknown as RequestEvent;
}

/** An event for a signed-out visitor: `getUser()` resolves to a null user. */
export function createUnauthenticatedRequestEvent(
  url: string,
  options: RequestOptions = {}
): RequestEvent {
  return {
    request: buildRequest(url, options),
    url: new URL(url),
    locals: {
      supabase: {
        auth: {
          getUser: () =>
            Promise.resolve({
              data: { user: null },
              error: null
            })
        }
      },
      safeGetSession: () =>
        Promise.resolve({
          session: null,
          user: null,
          profile: null,
          roles: { userId: '', platformRole: null, orgRoles: {} }
        })
    }
  } as unknown as RequestEvent;
}
