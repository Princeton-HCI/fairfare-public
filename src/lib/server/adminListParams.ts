/**
 * Parse common list query params (search / sort / pagination) from a request
 * URL for the admin list pages. Keeping this server-side and URL-driven makes
 * every list view deep-linkable and back-button-safe.
 */
export interface ListParams {
  q: string;
  sort: string;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
  /** Inclusive zero-based range start for Supabase `.range()`. */
  rangeFrom: number;
  /** Inclusive zero-based range end for Supabase `.range()`. */
  rangeTo: number;
}

const DEFAULT_DIR: 'asc' | 'desc' = 'desc';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function parseListParams(
  url: URL,
  opts: { allowedSorts: readonly string[]; defaultSort: string }
): ListParams {
  const { allowedSorts, defaultSort } = opts;

  const q = (url.searchParams.get('q') ?? '').trim();

  const requestedSort = url.searchParams.get('sort') ?? defaultSort;
  const sort = allowedSorts.includes(requestedSort) ? requestedSort : defaultSort;

  const dirParam = url.searchParams.get('dir');
  const dir: 'asc' | 'desc' = dirParam === 'asc' || dirParam === 'desc' ? dirParam : DEFAULT_DIR;

  const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawPageSize = Number.parseInt(
    url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE),
    10
  );
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(rawPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  return { q, sort, dir, page, pageSize, rangeFrom, rangeTo };
}

/** Escape a user search string for use inside a PostgREST `ilike` pattern. */
export function ilikePattern(q: string): string {
  // Strip PostgREST/`or` filter metacharacters that could break parsing.
  const sanitized = q.replace(/[,()*%]/g, ' ').trim();
  return `%${sanitized}%`;
}
