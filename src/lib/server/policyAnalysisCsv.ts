/**
 * Shared CSV utilities for policy analysis exports.
 * Used by both the streaming download endpoint and the background export processor.
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

export const COL_START_DATETIME = 3;
export const COL_ID = 21;

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

export function buildSummaryCSV(
  aggData: Record<string, number> | Record<string, number>[]
): string {
  const row = Array.isArray(aggData) ? aggData[0] : aggData;

  const startRow = 2;
  const endRow = row.total_trips + 1;
  const distanceCol = 'M';
  const chargeCol = 'P';
  const tipCol = 'T';
  const incomeCol = 'R';
  const durationCol = 'F';

  return [
    '',
    'Summary',
    'Description,Value,Excel Formula',
    `Total number of trips,${row.total_trips ?? 0}`,
    `Average distance per trip,${row.avg_distance ?? 0},=AVERAGE(${distanceCol + startRow}:${distanceCol + endRow})`,
    `Average customer charge per trip (including tips),${row.avg_charge ?? 0},=AVERAGE(${chargeCol + startRow}:${chargeCol + endRow})`,
    `Average customer charge per trip (excluding tips),${row.avg_charge_no_tip ?? 0},=(SUM(${chargeCol + startRow}:${chargeCol + endRow}) - SUM(${tipCol + startRow}:${tipCol + endRow})) / ${row.total_trips}`,
    `Average hourly rate (including tips),${row.avg_hourly_rate ?? 0},=SUM(${incomeCol + startRow}:${incomeCol + endRow}) / (SUM(${durationCol + startRow}:${durationCol + endRow})/3600)`,
    `Average hourly rate (excluding tips),${row.avg_hourly_rate_no_tip ?? 0},=(SUM(${incomeCol + startRow}:${incomeCol + endRow}) - SUM(${tipCol + startRow}:${tipCol + endRow})) / (SUM(${durationCol + startRow}:${durationCol + endRow})/3600)`,
    `Average account pay per trip (including tips),${row.avg_pay ?? 0},=AVERAGE(${incomeCol + startRow}:${incomeCol + endRow})`,
    `Average account pay per trip (excluding tips),${row.avg_pay_no_tip ?? 0},=(SUM(${incomeCol + startRow}:${incomeCol + endRow}) - SUM(${tipCol + startRow}:${tipCol + endRow})) / ${row.total_trips}`
  ].join('\n');
}
