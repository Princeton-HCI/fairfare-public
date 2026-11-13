/**
 * Shared CSV streaming utilities used by both the policy-analysis and
 * sick-time download endpoints.  Each endpoint supplies its own
 * `fetchBatch` closure (capturing query-specific params) and
 * `buildSummary` formatter; everything else — parsing, cursor logic,
 * the pull-based ReadableStream, and gzip compression — lives here.
 */

import { SUPABASE_SERVICE_KEY } from '$env/static/private';
import { PUB_VITE_SUPABASE_URL } from '$env/static/public';

export const CSV_HEADERS = [
  'Employer',
  'Status',
  'Time Zone',
  'Start Date',
  'End Date',
  'Duration (in seconds)',
  'Start Location Latitude',
  'Start Location Longitude',
  'Start Location Formatted Address',
  'End Location Latitude',
  'End Location Longitude',
  'End Location Formatted Address',
  'Distance',
  'Distance Unit',
  'Surge Ride',
  'Income Total Charge',
  'Income Pay',
  'Income Total',
  'Income Bonus',
  'Income Tips',
  'Income Fees'
];

export const BATCH_SIZE = 10_000;
const BATCH_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 1;

const COL_START_DATETIME = 3;
const COL_ID = 21;

/**
 * Parse a single CSV line into fields, handling quoted values.
 * Only called once per batch (on the last line) for cursor extraction.
 */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '"') {
          if (j + 1 < line.length && line[j + 1] === '"') {
            j += 2;
          } else {
            break;
          }
        } else {
          j++;
        }
      }
      fields.push(line.substring(i + 1, j).replace(/""/g, '"'));
      i = j + 2;
    } else {
      const next = line.indexOf(',', i);
      if (next === -1) {
        fields.push(line.substring(i));
        break;
      }
      fields.push(line.substring(i, next));
      i = next + 1;
    }
  }
  return fields;
}

export function countNewlines(s: string): number {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) count++;
  }
  return count;
}

/**
 * Strip the last comma-delimited field (the id column) from each line.
 * Uses lastIndexOf(',') per line instead of a regex scan over the full batch.
 */
export function stripLastColumn(data: string): string {
  const lines = data.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lastComma = lines[i].lastIndexOf(',');
    if (lastComma >= 0) {
      lines[i] = lines[i].substring(0, lastComma);
    }
  }
  return lines.join('\n');
}

export async function fetchBatchCSV(
  driverIds: string[] | null,
  startDateString: string | null,
  endDateString: string | null,
  startLocation: string | null,
  endLocation: string | null,
  locationAnd: boolean | null,
  platforms: string[] | null,
  cursorStartDatetime: string | null,
  cursorId: string | null
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${PUB_VITE_SUPABASE_URL}/rest/v1/rpc/get_policy_analysis_csv_rows`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Accept: 'text/csv'
        },
        signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
        body: JSON.stringify({
          p_start_date: startDateString || null,
          p_end_date: endDateString || null,
          p_start_location: startLocation || null,
          p_end_location: endLocation || null,
          p_location_and: locationAnd || false,
          p_platforms: platforms || null,
          p_driver_ids: driverIds,
          p_limit: BATCH_SIZE,
          p_cursor_start_datetime: cursorStartDatetime,
          p_cursor_id: cursorId
        })
      });

      if (!res.ok) {
        throw new Error(`PostgREST error: ${res.status} ${await res.text()}`);
      }

      return res.text();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1_000));
      }
    }
  }

  throw lastError!;
}

// ── Stream factory ──────────────────────────────────────────────────

export interface CsvStreamConfig {
  headers: string[];
  /** Fetch one page of CSV rows. Only the cursor values change between calls. */
  fetchBatch: (cursorStartDatetime: string | null, cursorId: string | null) => Promise<string>;
  /** Format aggregate data into the summary rows appended after all data. */
  buildSummary: (aggData: Record<string, number>) => string;
  /** Pre-fired aggregate query that resolves alongside the batch fetches. */
  aggPromise: PromiseLike<{ data: Record<string, number> | null; error: unknown }>;
}

/**
 * Build a pull-based ReadableStream that pages through CSV batches and
 * appends a summary section, then pipe it through gzip compression.
 *
 * Each `pull()` fetches one batch on demand so the consumer
 * (CompressionStream -> HTTP transport) controls the pace and memory
 * stays bounded to ~1 batch at a time.
 */
export function createCompressedCsvStream(config: CsvStreamConfig): ReadableStream {
  const { headers, fetchBatch, buildSummary, aggPromise } = config;
  const encoder = new TextEncoder();

  let cursorStartDatetime: string | null = null;
  let cursorId: string | null = null;
  let hasMore = true;
  let headerSent = false;

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (!headerSent) {
          headerSent = true;
          controller.enqueue(encoder.encode(headers.join(',') + '\n'));
          return;
        }

        if (hasMore) {
          const csvText = await fetchBatch(cursorStartDatetime, cursorId);

          const headerEnd = csvText.indexOf('\n');
          if (headerEnd === -1 || headerEnd >= csvText.length - 1) {
            hasMore = false;
          } else {
            const data = csvText.substring(headerEnd + 1).trimEnd();
            if (data.length === 0) {
              hasMore = false;
            } else {
              const lastNewline = data.lastIndexOf('\n');
              const lastLine = lastNewline >= 0 ? data.substring(lastNewline + 1) : data;
              const fields = parseCSVLine(lastLine);
              const nextId = fields[COL_ID] || null;

              if (!nextId) {
                hasMore = false;
              } else {
                cursorStartDatetime = fields[COL_START_DATETIME] || null;
                cursorId = nextId;
              }

              const stripped = stripLastColumn(data);
              controller.enqueue(encoder.encode(stripped + '\n'));

              const rowCount = countNewlines(data) + 1;
              if (rowCount < BATCH_SIZE) {
                hasMore = false;
              }

              return;
            }
          }
        }

        const { data: aggData, error: aggError } = await aggPromise;
        if (!aggError && aggData) {
          controller.enqueue(encoder.encode(buildSummary(aggData)));
        }
        if (aggError) {
          console.error('agg error:', aggError);
        }
        controller.close();
      } catch (error) {
        console.error('CSV stream error:', error);
        controller.error(error);
      }
    }
  });

  return stream.pipeThrough(new CompressionStream('gzip'));
}

/**
 * Build a complete CSV string by collecting all batches and
 * appending a summary section.
 * Used as fallback for environments that don't support streaming well.
 */
export async function createCompressedCsvString(config: CsvStreamConfig): Promise<string> {
  const { headers, fetchBatch, buildSummary, aggPromise } = config;
  const csvLines: string[] = [];
  csvLines.push(headers.join(','));

  let cursorStartDatetime: string | null = null;
  let cursorId: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const csvText = await fetchBatch(cursorStartDatetime, cursorId);

    const headerEnd = csvText.indexOf('\n');
    if (headerEnd === -1 || headerEnd >= csvText.length - 1) {
      hasMore = false;
    } else {
      const data = csvText.substring(headerEnd + 1).trimEnd();
      if (data.length === 0) {
        hasMore = false;
      } else {
        const lastNewline = data.lastIndexOf('\n');
        const lastLine = lastNewline >= 0 ? data.substring(lastNewline + 1) : data;
        const fields = parseCSVLine(lastLine);
        const nextId = fields[COL_ID] || null;

        if (!nextId) {
          hasMore = false;
        } else {
          cursorStartDatetime = fields[COL_START_DATETIME] || null;
          cursorId = nextId;
        }

        const stripped = stripLastColumn(data);
        csvLines.push(stripped);

        const rowCount = countNewlines(data) + 1;
        if (rowCount < BATCH_SIZE) {
          hasMore = false;
        }
      }
    }
  }

  const { data: aggData, error: aggError } = await aggPromise;
  if (!aggError && aggData) {
    csvLines.push(buildSummary(aggData));
  }
  if (aggError) {
    console.error('agg error:', aggError);
  }

  return csvLines.join('\n');
}

export function buildFilterFilename(filters: {
  prefix?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startLocation?: string | null;
  endLocation?: string | null;
  locationCombiner?: string | null;
  platforms?: string[] | string | null;
}): string {
  const now = new Date().toISOString().split('T')[0];
  const parts: string[] = [];

  if (filters.prefix) parts.push(filters.prefix);
  parts.push('DOWNLOADED-' + now);
  if (filters.startDate) parts.push('FROM-' + filters.startDate);
  if (filters.endDate) parts.push('TO-' + filters.endDate);
  if (filters.startLocation) parts.push('START-' + filters.startLocation);
  if (filters.startLocation && filters.endLocation && filters.locationCombiner) {
    parts.push(filters.locationCombiner);
  }
  if (filters.endLocation) parts.push('END-' + filters.endLocation);

  const platformList = Array.isArray(filters.platforms)
    ? filters.platforms
    : filters.platforms
      ? [filters.platforms]
      : [];
  if (platformList.length > 0) parts.push('PLATFORMS-' + platformList.join(','));

  return parts.join('_');
}
