/**
 * A local stand-in for the Argyle API, for the Playwright suite.
 *
 * The webhook tests used to drive the real Argyle sandbox with three IDs pasted
 * into the spec, under a comment warning that the connection expires after 60
 * days. When it expired, CI failed for everyone with a 500 that looked like a
 * code bug. The sandbox is also shared mutable state: anyone reconnecting the
 * demo account changed what the tests saw.
 *
 * Responses are *recorded* sandbox responses, in tests/fixtures/argyle, captured
 * by `pnpm run snapshot:argyle-stub`. They were hand-written at first, which is
 * guesswork and was wrong at least once — `/user-tokens` was given `access` and
 * `refresh` fields while the app reads `user_token`, so `getUserToken()` quietly
 * resolved to `undefined` with every test still green. Re-run the recorder to
 * refresh them when Argyle changes a shape.
 *
 * Two things are deliberately *not* served verbatim:
 *
 *   ids   — every identifier is regenerated per request. Ids belong to entities,
 *           not to shapes, and serving the recorded ones hands every test driver
 *           the same Argyle account, which collides on insert and leaves a
 *           driver looking already-linked on the next run.
 *   next  — pagination links are nulled. The recorded gigs page carries a real
 *           `https://api-sandbox.argyle.com/...` cursor, and the app follows
 *           `next` until it is null, so serving it would send a test that
 *           believes it is offline straight to the live API.
 *
 * Set ARGYLE_LIVE=1 to point the app at the real sandbox instead. The app reads
 * PUB_ARGYLE_LINK_URL through `$env/static/public`, which Vite inlines at build
 * time, so the URL below has to be set for `pnpm build` — see `webServer.env` in
 * playwright.config.ts and the Playwright job in ci.yaml.
 */

import { createServer, type Server } from 'http';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export const ARGYLE_STUB_PORT = 4180;
export const ARGYLE_STUB_URL = `http://127.0.0.1:${ARGYLE_STUB_PORT}`;

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'argyle');

type Fixture = { capturedAt: string; source: string; status: number; body: unknown };

const fixture = (name: string): Fixture => {
  try {
    return JSON.parse(readFileSync(resolve(FIXTURE_DIR, `${name}.json`), 'utf8'));
  } catch (error) {
    throw new Error(
      `argyle stub: missing fixture ${name}.json. Run \`pnpm run snapshot:argyle-stub\` ` +
        `to record it from the sandbox. (${(error as Error).message})`
    );
  }
};

/** A deep copy, so per-request rewrites never mutate the loaded fixture. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type Json = Record<string, unknown>;

let requestCount = 0;

/** Number of requests served, so a test can assert the app talked to Argyle at all. */
export const getArgyleStubRequestCount = () => requestCount;

export function startArgyleStub(): Promise<Server> {
  // Loaded once, at startup, so a missing or malformed fixture fails loudly here
  // rather than as a puzzling 500 in the middle of a test.
  const fixtures = {
    accountsList: fixture('accounts-list'),
    accountById: fixture('account-by-id'),
    identitiesList: fixture('identities-list'),
    identityById: fixture('identity-by-id'),
    gigsList: fixture('gigs-list'),
    userCreated: fixture('user-created'),
    userToken: fixture('user-token')
  };

  const server = createServer((request, response) => {
    requestCount++;
    if (process.env.ARGYLE_STUB_LOG === '1') {
      console.log(`[argyle-stub] ${request.method} ${request.url}`);
    }

    const url = new URL(request.url ?? '/', ARGYLE_STUB_URL);
    const path = url.pathname.replace(/^\/v2/, '');
    const send = (body: unknown, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    /** Serves a recorded body after `rewrite` has replaced its ids. */
    const serve = (f: Fixture, rewrite: (body: Json) => Json) =>
      send(rewrite(clone(f.body) as Json), f.status);

    // POST /v2/users — a new Argyle user.
    // The id must be globally unique: the app writes it to profiles.argyle_user,
    // which is unique-constrained, so a fixed one fails the second driver.
    if (request.method === 'POST' && path === '/users') {
      return serve(fixtures.userCreated, (body) => ({ ...body, id: randomUUID() }));
    }

    // POST /v2/user-tokens — a short-lived token for Argyle Link. The recorded
    // token value is redacted; nothing under test reads it back.
    if (request.method === 'POST' && path === '/user-tokens') {
      return serve(fixtures.userToken, (body) => body);
    }

    // GET /v2/identities?user=… | ?account=…
    if (request.method === 'GET' && path === '/identities') {
      const user = url.searchParams.get('user');
      const account = url.searchParams.get('account') ?? randomUUID();
      return serve(fixtures.identitiesList, (body) => ({
        ...body,
        next: null,
        previous: null,
        results: ((body.results as Json[]) ?? []).map((identity) => ({
          ...identity,
          id: randomUUID(),
          account,
          ...(user ? { user } : {})
        }))
      }));
    }

    // GET /v2/identities/{id}
    if (request.method === 'GET' && path.startsWith('/identities/')) {
      const id = path.split('/')[2];
      return serve(fixtures.identityById, (body) => ({
        ...body,
        id,
        account: randomUUID()
      }));
    }

    // GET /v2/accounts?user=…
    if (request.method === 'GET' && path === '/accounts') {
      const user = url.searchParams.get('user') ?? randomUUID();
      return serve(fixtures.accountsList, (body) => ({
        ...body,
        next: null,
        previous: null,
        results: ((body.results as Json[]) ?? []).map((account) => ({
          ...account,
          id: randomUUID(),
          user
        }))
      }));
    }

    // GET /v2/accounts/{id}
    if (request.method === 'GET' && path.startsWith('/accounts/')) {
      const id = path.split('/')[2];
      return serve(fixtures.accountById, (body) => ({ ...body, id, user: randomUUID() }));
    }

    // GET /v2/gigs?account=… — one page, so the app's pagination loop terminates
    if (request.method === 'GET' && path === '/gigs') {
      const account = url.searchParams.get('account') ?? randomUUID();
      return serve(fixtures.gigsList, (body) => ({
        ...body,
        next: null,
        previous: null,
        results: ((body.results as Json[]) ?? []).map((gig) => ({
          ...gig,
          id: randomUUID(),
          account
        }))
      }));
    }

    return send({ error: `argyle stub: unhandled ${request.method} ${url.pathname}` }, 404);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(ARGYLE_STUB_PORT, '127.0.0.1', () => resolve(server));
  });
}
