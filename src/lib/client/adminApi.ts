import { toast } from '@src/lib/toasts';

/**
 * Call an `/api/admin/*` endpoint from an admin page. Shows the server's error
 * as a toast and returns whether the request succeeded.
 *
 * Failures come in two shapes: route handlers respond `{ error }` from
 * `handleApiError`, while the auth guards (`requireAdminApi`) throw before the
 * handler runs and SvelteKit serializes those as `{ message }`. Read both so an
 * expired session or a 403 shows its real cause instead of "Request failed".
 */
export async function adminApiRequest(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<boolean> {
  return (await adminApiRequestJson(path, method, body)) !== null;
}

/**
 * `adminApiRequest` for the callers that have to report what the server
 * actually did rather than just that it succeeded — returns the parsed success
 * payload, or `null` after showing the error toast.
 */
export async function adminApiRequestJson<T = Record<string, unknown>>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<T | null> {
  const response = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  // A success with no body (or a non-JSON one) is still a success: fall back to
  // an empty payload so callers that ignore the body keep working.
  const payload = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    message?: unknown;
  };

  if (response.ok) return payload as T;

  const detail = [payload.error, payload.message].find(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  toast({ text: detail ?? 'Request failed', type: 'error' });
  return null;
}
