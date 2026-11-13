import { config } from 'dotenv';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

config(); // Load env vars

/**
 * Set up handlers for msw
 */

export const server = setupServer(...handlers);
export const unexpectedRequests: string[] = [];
let blockNetwork = false;
export const blockUnhandledRequests = () => {
  blockNetwork = true;
};

/**
 * Note that there is deliberately no global "delete every test user" step here.
 *
 * `beforeAll` runs once per test *file*, so a global wipe deleted fixtures that
 * other files were using at that moment — the suite only passed with file
 * parallelism turned off, and even then left the ordering fragile. Each test now
 * creates uniquely-addressed users (see tests/utils/testUser.ts) and tears down
 * exactly what it created.
 *
 * To clear users left behind by an interrupted run: `pnpm test:clean-users`.
 */

/**
 * `listen()` runs here at module scope, not inside `beforeAll`.
 *
 * Setup files are evaluated before the spec module is imported, and the spec
 * imports `src/lib/server/db.ts`, which builds the Supabase client. supabase-js
 * captures `globalThis.fetch` once, when the client is constructed
 * (`resolveFetch` in @supabase/supabase-js), and closes over that reference.
 * Starting MSW in `beforeAll` swapped in the interceptor *after* that capture,
 * so every REST, storage and auth call made through this client went straight
 * to the network: handlers registered against Supabase URLs — including
 * `scopeDatabaseReads` — silently did nothing.
 */
server.listen({
  onUnhandledRequest(request, print) {
    if (blockNetwork) {
      unexpectedRequests.push(`${request.method} ${new URL(request.url).pathname}`);
      print.error();
      return;
    }
    // Do not print warnings on unhandled requests to the local Supabase stack
    // (auth, rest and storage all talk to the real thing in the db project).
    if (/^http:\/\/(localhost|127\.0\.0\.1):54321\//.test(request.url)) {
      return;
    }

    // Print the regular MSW unhandled request warning otherwise.
    print.warning();
  }
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
});
