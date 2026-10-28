import { bypass, http } from 'msw';
import { PUB_VITE_SUPABASE_URL } from '$env/static/public';
import { server } from '../setupTests';

/**
 * Restrict a global worker's SELECTs to fixtures owned by this test. PostgREST
 * still executes the real query, with its original filters/order/limit, and all
 * writes and storage operations remain real. This is a test-only work-selection
 * boundary, not a change to the production worker's global scope.
 *
 * Runtime handlers are reset by setupTests after each test.
 */
export function scopeDatabaseReads(table: string, column: string, value: string) {
  server.use(
    http.get(`${PUB_VITE_SUPABASE_URL}/rest/v1/${table}`, ({ request }) => {
      const url = new URL(request.url);
      url.searchParams.append(column, `eq.${value}`);
      // Method and headers are copied field by field rather than passing
      // `request` as the init, which would also carry over its `signal`. Under
      // jsdom that signal is jsdom's AbortSignal, and undici brand-checks it:
      // Node 24 (the version the vitest CI job runs) rejects it with "Expected
      // signal to be an instance of AbortSignal", failing every scoped read.
      // Node 22 accepted it, so this only showed up in CI.
      const scoped = new Request(url, {
        method: request.method,
        headers: [...request.headers]
      });
      return fetch(bypass(scoped));
    })
  );
}
