import { isHttpError, json } from '@sveltejs/kit';

export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Turn a thrown error into a JSON response. Understands both our `HttpError`
 * and SvelteKit's `error(status, message)` (which `requireCapability` and the
 * admin guards throw), so a 403 from an authorization check inside a `try`
 * block stays a 403 instead of becoming a 500.
 */
export function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, { status: error.status });
  }

  if (isHttpError(error)) {
    return json({ error: error.body.message }, { status: error.status });
  }

  console.error(fallbackMessage, error);
  return json({ error: fallbackMessage }, { status: 500 });
}

/**
 * Read a JSON request body without letting a malformed one throw. Handlers
 * validate the individual fields they need, so an unparseable body is just an
 * absent one.
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}

/** Read a trimmed string field from a parsed JSON body, or `''` when absent. */
export function stringField(body: Record<string, unknown> | null, key: string): string {
  const value = body?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Translate a Postgres error into an `HttpError`. `P0001` is what our
 * membership triggers and RPCs raise for a rule the caller broke (the last-lead
 * guard, which exempts admins, is the one they raise today), so it surfaces as a
 * 409 carrying the raised message; anything else is a genuine server fault.
 */
export function postgresHttpError(
  error: { code?: string; message: string },
  fallback: string
): HttpError {
  if (error.code === 'P0001') return new HttpError(error.message, 409);
  return new HttpError(fallback, 500);
}
