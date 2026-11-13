/**
 * Records real Argyle sandbox responses as fixtures for the Playwright stub.
 *
 *   pnpm run snapshot:argyle-stub
 *
 * The stub (tests/argyleStub.ts) used to answer with shapes written by hand from
 * how the app consumes them. That is guesswork, and it was wrong at least once:
 * `/user-tokens` returned `access`/`refresh` while the app reads `user_token`,
 * so `getUserToken()` resolved to `undefined` and every test still passed.
 * Recording the real responses removes the guessing.
 *
 * Requires a connected sandbox account. Argyle sandbox connections expire after
 * ~60 days; if this script finds no accounts, reconnect test1@argyle.com through
 * Argyle Link and run it again. Re-running it is how the fixtures get refreshed.
 *
 * Secrets are redacted before anything is written — see `redact` below. Only the
 * sandbox is allowed: the script refuses to run against any other host.
 */

import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '..', 'tests', 'fixtures', 'argyle');

const ARGYLE_URL = process.env.PUB_ARGYLE_LINK_URL;
const API_KEY = process.env.VITE_ARGYLE_API_KEY;
const API_SECRET = process.env.VITE_ARGYLE_API_SECRET;

/** Fields that must never land in a committed fixture. */
const SECRET_FIELDS = new Set(['user_token', 'access', 'refresh', 'token', 'ssn']);

/**
 * Pagination links are dropped at record time as well as at serve time. A live
 * `next` cursor embeds the Argyle client id, and the app follows `next` until it
 * is null — so a committed cursor is both an identifier in the repo and a way
 * for a test that believes it is offline to reach the real API.
 */
const PAGINATION_FIELDS = new Set(['next', 'previous']);
const REDACTED: Record<string, string> = {
  user_token: 'REDACTED-USER-TOKEN',
  access: 'REDACTED-ACCESS-TOKEN',
  refresh: 'REDACTED-REFRESH-TOKEN',
  token: 'REDACTED-TOKEN',
  ssn: '000-00-0000'
};

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => {
        if (SECRET_FIELDS.has(key) && inner !== null) return [key, REDACTED[key]];
        if (PAGINATION_FIELDS.has(key)) return [key, null];
        return [key, redact(inner)];
      })
    );
  }
  return value;
};

const argyleFetch = async (path: string, init?: RequestInit) => {
  const authorization = 'Basic ' + Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  const url = `${ARGYLE_URL}/v2${path}`;
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, accept: 'application/json', authorization }
  });
  const body = await response.json();
  return { url, status: response.status, body };
};

const write = async (name: string, captured: { url: string; status: number; body: unknown }) => {
  const file = resolve(OUTPUT_DIR, `${name}.json`);
  await writeFile(
    file,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        source: captured.url,
        status: captured.status,
        body: redact(captured.body)
      },
      null,
      2
    ) + '\n'
  );
  console.log(`  ${name}.json  (${captured.status})`);
};

const main = async () => {
  if (!ARGYLE_URL || !API_KEY || !API_SECRET) {
    throw new Error('Missing PUB_ARGYLE_LINK_URL, VITE_ARGYLE_API_KEY or VITE_ARGYLE_API_SECRET.');
  }
  if (!new URL(ARGYLE_URL).hostname.includes('sandbox')) {
    throw new Error(`Refusing to record from a non-sandbox host: ${ARGYLE_URL}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Recording from ${ARGYLE_URL} into tests/fixtures/argyle:`);

  // A connected account is the anchor for everything else.
  const accounts = await argyleFetch('/accounts?limit=2');
  const account = (accounts.body as { results?: { id: string; user: string }[] }).results?.[0];
  if (!account) {
    throw new Error(
      'No connected sandbox accounts. Reconnect test1@argyle.com through Argyle Link, then re-run.'
    );
  }
  await write('accounts-list', accounts);
  await write('account-by-id', await argyleFetch(`/accounts/${account.id}`));

  const identities = await argyleFetch(`/identities?account=${account.id}`);
  await write('identities-list', identities);

  const identity = (identities.body as { results?: { id: string }[] }).results?.[0];
  if (identity) {
    await write('identity-by-id', await argyleFetch(`/identities/${identity.id}`));
  } else {
    console.warn('  (no identity for this account; identity-by-id not refreshed)');
  }

  // A small page of gigs: enough to show the shape, not a data dump.
  await write('gigs-list', await argyleFetch(`/gigs?account=${account.id}&limit=5`));

  // These two create sandbox records, which is the only way to see their real
  // response shape. Both are sandbox-only and disposable.
  await write('user-created', await argyleFetch('/users', { method: 'POST' }));
  await write(
    'user-token',
    await argyleFetch('/user-tokens', {
      method: 'POST',
      body: new URLSearchParams({ user: account.user })
    })
  );

  console.log('\nDone. Review the diff before committing — fixtures are real responses.');
};

main();
