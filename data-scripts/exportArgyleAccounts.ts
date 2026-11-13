/**
 * Downloads every account in System's Argyle account (global keys) and saves
 * one row per account to public.argyle_accounts_export.
 *
 * Usage:
 *   pnpm export:argyle-accounts                                  # uses .env
 *   pnpm export:argyle-accounts --env-file .env.production --yes
 *
 * The env file needs PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY,
 * PUB_ARGYLE_LINK_URL, VITE_ARGYLE_API_KEY and VITE_ARGYLE_API_SECRET. Writing
 * to a Supabase that isn't local needs --yes.
 *
 * Each run replaces the whole table. All accounts are downloaded before the
 * table is touched, so an Argyle failure leaves the previous data in place.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import type { Database, Json } from '../src/lib/schema.js';
import type { ArgyleAccountResponse } from '../src/lib/types.js';

/** The largest page Argyle's list endpoints allow. */
const PAGE_SIZE = 200;
/** Stops a broken `next` link from looping forever (200,000 accounts). */
const MAX_PAGES = 1000;
const MAX_ATTEMPTS = 5;
const INSERT_BATCH_SIZE = 500;

const args = process.argv.slice(2);
const envFileIndex = args.indexOf('--env-file');
const envFile = envFileIndex >= 0 ? args[envFileIndex + 1] : '.env';
const confirmed = args.includes('--yes');

if (!envFile) {
  console.error('--env-file needs a path, e.g. --env-file .env.production');
  process.exit(1);
}
const loaded = config({ path: envFile, override: true });
if (loaded.error) {
  console.error(`Could not read ${envFile}: ${loaded.error.message}`);
  process.exit(1);
}

const required = [
  'PUB_VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'PUB_ARGYLE_LINK_URL',
  'VITE_ARGYLE_API_KEY',
  'VITE_ARGYLE_API_SECRET'
] as const;
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing in ${envFile}: ${missing.join(', ')}`);
  process.exit(1);
}

const supabaseUrl = process.env.PUB_VITE_SUPABASE_URL!;
const argyleUrl = process.env.PUB_ARGYLE_LINK_URL!;
const authorization =
  'Basic ' +
  Buffer.from(`${process.env.VITE_ARGYLE_API_KEY}:${process.env.VITE_ARGYLE_API_SECRET}`).toString(
    'base64'
  );

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl);

const supabase = createClient<Database>(supabaseUrl, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { persistSession: false }
});

type AccountsPage = { results: ArgyleAccountResponse[]; next: string | null };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** An Argyle error that retrying won't fix, such as bad API keys. */
class PermanentArgyleError extends Error {}

/** Fetches one page, retrying rate limits, server errors and network failures. */
const fetchPage = async (cursor: string | null): Promise<AccountsPage> => {
  const params = new URLSearchParams({ limit: PAGE_SIZE.toString() });
  if (cursor) params.set('cursor', cursor);
  const url = `${argyleUrl}/v2/accounts?${params}`;

  for (let attempt = 1; ; attempt++) {
    let failure: string;
    try {
      const res = await fetch(url, { headers: { accept: 'application/json', authorization } });
      if (res.ok) return (await res.json()) as AccountsPage;
      failure = `${res.status}: ${await res.text()}`;
      if (res.status < 500 && res.status !== 429) {
        throw new PermanentArgyleError(`Listing Argyle accounts failed: ${failure}`);
      }
    } catch (err) {
      if (err instanceof PermanentArgyleError) throw err;
      failure = String(err);
    }
    if (attempt >= MAX_ATTEMPTS) throw new Error(`Listing Argyle accounts failed: ${failure}`);
    const backoffMs = Math.min(1000 * 2 ** attempt, 30_000);
    console.warn(`  Argyle request failed (${failure}); retrying in ${backoffMs / 1000}s`);
    await wait(backoffMs);
  }
};

/**
 * The cursor in Argyle's `next` link; null on the last page. Only the cursor is
 * reused, so the API keys are never sent to whatever host `next` names.
 */
const cursorFrom = (next: string | null): string | null => {
  if (!next) return null;
  const cursor = new URL(next).searchParams.get('cursor');
  if (!cursor) throw new Error(`Argyle's next link has no cursor: ${next}`);
  return cursor;
};

const downloadAllAccounts = async (): Promise<ArgyleAccountResponse[]> => {
  const accounts: ArgyleAccountResponse[] = [];
  let cursor: string | null = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchPage(cursor);
    accounts.push(...result.results);
    console.log(`  page ${page}: ${result.results.length} accounts (${accounts.length} total)`);
    cursor = cursorFrom(result.next);
    if (!cursor) return accounts;
  }
  throw new Error(`Still more pages after ${MAX_PAGES}; stopping`);
};

const toRow = (
  account: ArgyleAccountResponse
): Database['public']['Tables']['argyle_accounts_export']['Insert'] => ({
  argyle_account: account.id,
  argyle_user: account.user ?? null,
  employers: account.employers ?? null,
  connection_status: account.connection?.status ?? null,
  connection_error_code: account.connection?.error_code ?? null,
  connection_error_message: account.connection?.error_message ?? null,
  connection_updated_at: account.connection?.updated_at ?? null,
  argyle_created_at: account.created_at ?? null,
  argyle_updated_at: account.updated_at ?? null,
  account: account as unknown as Json
});

/** Empties the table, then saves `accounts` in its place. */
const replaceAccounts = async (accounts: ArgyleAccountResponse[]) => {
  // Argyle can return an account twice if it changes order mid-listing.
  const unique = [...new Map(accounts.map((a) => [a.id, a])).values()];
  if (unique.length < accounts.length) {
    console.log(`  skipped ${accounts.length - unique.length} duplicate accounts`);
  }

  // delete() needs a filter; every row has an id.
  const { count, error } = await supabase
    .from('argyle_accounts_export')
    .delete({ count: 'exact' })
    .not('id', 'is', null);
  if (error) throw new Error(`Emptying the table failed: ${error.message}`);
  console.log(`  deleted ${count ?? 0} old rows`);

  for (let i = 0; i < unique.length; i += INSERT_BATCH_SIZE) {
    const rows = unique.slice(i, i + INSERT_BATCH_SIZE).map(toRow);
    const { error } = await supabase.from('argyle_accounts_export').insert(rows);
    if (error) {
      throw new Error(
        `Saving rows failed after ${i} of ${unique.length}: ${error.message}\n` +
          'The table is incomplete; re-run the script to replace it.'
      );
    }
    console.log(`  saved ${Math.min(i + INSERT_BATCH_SIZE, unique.length)}/${unique.length}`);
  }
  return unique.length;
};

const countByStatus = (accounts: ArgyleAccountResponse[]) => {
  const counts = new Map<string, number>();
  for (const a of accounts) {
    const status = a.connection?.status ?? '(none)';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const main = async () => {
  console.log(`Env file:  ${envFile}`);
  console.log(`Argyle:    ${argyleUrl}`);
  console.log(`Supabase:  ${supabaseUrl}${isLocal ? ' (local)' : ''}`);

  if (!isLocal && !confirmed) {
    console.error('\nThis Supabase is not local. Re-run with --yes to write to it.');
    process.exit(1);
  }

  console.log('\nDownloading accounts from Argyle...');
  const accounts = await downloadAllAccounts();

  // An empty list most likely means wrong keys or environment, not zero accounts.
  if (accounts.length === 0) {
    console.error('\nArgyle returned no accounts; leaving the table unchanged.');
    process.exit(1);
  }

  console.log(`\nReplacing argyle_accounts_export with ${accounts.length} accounts...`);
  const saved = await replaceAccounts(accounts);

  console.log(`\nDone: ${saved} accounts saved. Connection status counts:`);
  for (const [status, count] of countByStatus(accounts)) {
    console.log(`  ${status}: ${count}`);
  }
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
