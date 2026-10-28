import { supabase as serverSupabase } from '@src/lib/server/db';
import type { Json } from '@src/lib/schema';

/**
 * Reads of the unified admin audit feed (`public.admin_audit_events`, a
 * service-role-only union of the three audit tables).
 *
 * Paging is keyset, not offset. An audit feed is append-at-the-head: with
 * `LIMIT/OFFSET`, a row written while an admin is reading shifts every later
 * page by one and silently duplicates a row across the boundary. Keying off the
 * last row the admin actually saw makes the sequence stable no matter what gets
 * appended mid-read, and lets Postgres seek straight into the
 * `(created_at, id)` indexes instead of counting past every skipped row.
 *
 * The key is `(at, id)`, not `at` alone: `now()` is transaction-start time, so
 * one request that writes to two of the audit tables produces two rows with an
 * identical microsecond timestamp, and a timestamp-only key would drop a row at
 * every such boundary.
 */

export const AUDIT_SOURCES = ['admin', 'organizer', 'download'] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];
/** `all` is the unfiltered feed, not a source the view emits. */
export type AuditSourceFilter = AuditSource | 'all';

export interface AuditEvent {
  id: string;
  source: string;
  at: string | null;
  /** Actor email where it can be resolved, else the raw user id. */
  actor: string;
  action: string;
  target: string;
  detail: Json | null;
}

export interface AuditCursor {
  at: string;
  id: string;
}

export type AuditDirection = 'older' | 'newer';

export interface AuditPage {
  events: AuditEvent[];
  /** Total events matching the source filter, ignoring the cursor, or null
   *  when the count itself failed — never 0, which would read as "empty". */
  total: number | null;
  /** Cursor for the page of newer events, or null at the head of the feed. */
  newer: string | null;
  /** Cursor for the page of older events, or null at the tail. */
  older: string | null;
}

export const DEFAULT_AUDIT_PAGE_SIZE = 50;
const MAX_AUDIT_PAGE_SIZE = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres' own `timestamptz` rendering, which is the only thing a cursor is
 * ever built from. `Date.parse` is far looser — it accepts `2026-01-01 (a,b)`,
 * parentheses and commas included — and the timestamp is interpolated verbatim
 * into the PostgREST `or=(...)` expression below, where those characters are
 * structural. A permissive check therefore turns a hand-edited URL into a 400
 * rather than the documented fallback to the head of the feed.
 */
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * `<timestamp>|<uuid>`.
 *
 * The timestamp keeps every digit Postgres gave us — routing it through a JS
 * `Date` would truncate microseconds to milliseconds, and a truncated cursor
 * either re-shows or skips whatever sits inside that millisecond. Only the UTC
 * offset is rewritten, `+00:00` to `Z`: the two are the same instant to
 * Postgres, but a literal `+` in a query string is a space to any decoder that
 * treats it as form-encoded, which would quietly turn the cursor into garbage.
 */
export function encodeAuditCursor(cursor: AuditCursor): string {
  return `${cursor.at.replace(/\+00:00$/, 'Z')}|${cursor.id}`;
}

/** Returns null for anything malformed, so a hand-edited URL falls back to the
 *  head of the feed rather than erroring. */
export function decodeAuditCursor(raw: string | null): AuditCursor | null {
  if (!raw) return null;
  const separator = raw.lastIndexOf('|');
  if (separator <= 0) return null;

  // Restore the offset a form-encoded decode would have eaten (see above).
  const at = raw.slice(0, separator).replace(/ 00:00$/, '+00:00');
  const id = raw.slice(separator + 1);
  if (!UUID_RE.test(id)) return null;
  if (!TIMESTAMP_RE.test(at)) return null;

  return { at, id };
}

export function parseAuditSource(raw: string | null): AuditSourceFilter {
  return AUDIT_SOURCES.includes((raw ?? '') as AuditSource) ? (raw as AuditSource) : 'all';
}

export function parseAuditPageSize(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_AUDIT_PAGE_SIZE;
  return Math.min(parsed, MAX_AUDIT_PAGE_SIZE);
}

export interface AuditPageQuery {
  source: AuditSourceFilter;
  cursor: AuditCursor | null;
  direction: AuditDirection;
  pageSize: number;
}

/** Parse the whole query string of `/admin/audit` into a page request. */
export function parseAuditPageQuery(url: URL): AuditPageQuery {
  const after = url.searchParams.get('after');
  const before = url.searchParams.get('before');
  // `after` (walking back toward the head) wins if both are somehow present.
  const cursor = decodeAuditCursor(after ?? before);
  // The direction follows the *decoded* cursor, not the bare param: an
  // unusable `after` has to restart at the head like any other bad cursor, and
  // an ascending scan with no cursor starts at the tail — it would serve the
  // oldest page of the feed dressed up as the newest.
  const direction: AuditDirection = cursor && after ? 'newer' : 'older';

  return {
    source: parseAuditSource(url.searchParams.get('source')),
    cursor,
    direction,
    pageSize: parseAuditPageSize(url.searchParams.get('pageSize'))
  };
}

const SELECT_COLUMNS = 'id, source, at, actor_id, actor_email, action, target, detail';

export async function fetchAuditPage(query: AuditPageQuery): Promise<AuditPage> {
  const { source, cursor, direction, pageSize } = query;
  // Walking toward newer events means scanning ascending from the cursor; the
  // window is flipped back to newest-first before it is returned.
  const ascending = direction === 'newer';

  let rowsQuery = serverSupabase
    .from('admin_audit_events')
    .select(SELECT_COLUMNS)
    .order('at', { ascending })
    .order('id', { ascending })
    // One extra row is the "is there another page" probe; it is never rendered.
    .limit(pageSize + 1);

  let countQuery = serverSupabase
    .from('admin_audit_events')
    .select('id', { count: 'exact', head: true });

  if (source !== 'all') {
    rowsQuery = rowsQuery.eq('source', source);
    countQuery = countQuery.eq('source', source);
  }

  if (cursor) {
    // The row-wise comparison `(at, id) < (cursor.at, cursor.id)` spelled out
    // for PostgREST, which has no row-value syntax.
    //
    // The leading `at <= cursor.at` is logically implied by the OR beside it
    // and exists purely to give the planner something index-able. An OR across
    // two columns can only be a Filter on the `(at DESC, id DESC)` index, so
    // without it every branch of the union restarts at the head of its index
    // and re-reads each row newer than the cursor — an O(offset) walk, which is
    // the whole thing keyset paging is meant to avoid. With it, each branch
    // seeks (`Index Cond: at <= X`) and the OR only sieves the handful of rows
    // sharing the cursor's exact timestamp.
    const op = ascending ? 'gt' : 'lt';
    rowsQuery = ascending ? rowsQuery.gte('at', cursor.at) : rowsQuery.lte('at', cursor.at);
    rowsQuery = rowsQuery.or(`at.${op}.${cursor.at},and(at.eq.${cursor.at},id.${op}.${cursor.id})`);
  }

  const [rowsResult, countResult] = await Promise.all([rowsQuery, countQuery]);

  // An audit log that renders a failed read as "no events" is worse than one
  // that errors: an admin cannot tell "the query broke" from "nothing
  // happened". The count is cosmetic, so only the rows read is fatal.
  if (rowsResult.error) {
    console.error('Error loading audit events:', rowsResult.error);
    throw new Error(`Failed to load audit events: ${rowsResult.error.message}`);
  }
  if (countResult.error) console.error('Error counting audit events:', countResult.error);

  const fetched = rowsResult.data ?? [];
  const hasMore = fetched.length > pageSize;
  const pageRows = fetched.slice(0, pageSize);
  if (ascending) pageRows.reverse();

  const events: AuditEvent[] = pageRows.map((row) => ({
    id: row.id ?? '',
    source: row.source ?? 'unknown',
    at: row.at,
    actor: row.actor_email ?? row.actor_id ?? 'unknown',
    action: row.action ?? '',
    target: row.target ?? '',
    detail: row.detail
  }));

  // Scanning ascending means we arrived from an older page, so there is always
  // something older; scanning descending from a cursor means the same about
  // newer. In each case the probe row answers the other direction.
  const hasNewer = ascending ? hasMore : cursor !== null;
  const hasOlder = ascending ? true : hasMore;

  const first = events.at(0);
  const last = events.at(-1);

  return {
    events,
    total: countResult.error ? null : (countResult.count ?? 0),
    newer: hasNewer && first?.at ? encodeAuditCursor({ at: first.at, id: first.id }) : null,
    older: hasOlder && last?.at ? encodeAuditCursor({ at: last.at, id: last.id }) : null
  };
}
