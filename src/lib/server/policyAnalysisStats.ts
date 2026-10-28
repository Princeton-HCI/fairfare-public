import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/schema';

export type PolicyStats = {
  total_trips: number;
  avg_distance: number;
  avg_charge: number;
  avg_charge_no_tip: number;
  avg_hourly_rate: number;
  avg_hourly_rate_no_tip: number;
  avg_pay: number;
  avg_pay_no_tip: number;
};

export type PolicyStatsFilters = {
  startDate: string | null;
  endDate: string | null;
  startState: string | null;
  endState: string | null;
  matchAllStates: boolean;
  employers: string[] | null;
  driverIds: string[] | null;
};

type PolicyStatsBatchRow = {
  batch_trips: number | string | null;
  sum_distance: number | string | null;
  sum_charges: number | string | null;
  sum_pay: number | string | null;
  sum_tips: number | string | null;
  sum_duration: number | string | null;
  next_cursor_start_datetime: string | null;
  next_cursor_id: string | null;
  has_more: boolean | null;
};

const DEFAULT_BATCH_SIZE = 10000;
const MIN_BATCH_SIZE = 100;

function isStatementTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { message?: string; code?: string; details?: string };
  const message = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
  return (
    err.code === '57014' ||
    message.includes('statement timeout') ||
    message.includes('canceling statement due to statement timeout')
  );
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchPolicyAnalysisStats(
  supabase: SupabaseClient<Database>,
  filters: PolicyStatsFilters,
  batchSize = DEFAULT_BATCH_SIZE
): Promise<PolicyStats> {
  let cursorStartDatetime: string | null = null;
  let cursorId: string | null = null;

  let totalTrips = 0;
  let totalDistance = 0;
  let totalCharges = 0;
  let totalPay = 0;
  let totalTips = 0;
  let totalDuration = 0;
  let currentBatchSize = Math.max(batchSize, MIN_BATCH_SIZE);

  while (true) {
    let data: unknown = null;
    let error: unknown = null;

    while (true) {
      const result = await supabase
        .rpc('get_policy_analysis_stats_batch', {
          in_start_date: filters.startDate ?? undefined,
          in_end_date: filters.endDate ?? undefined,
          in_start_state: filters.startState ?? undefined,
          in_end_state: filters.endState ?? undefined,
          in_match_all_states: filters.matchAllStates,
          in_employers: filters.employers ?? undefined,
          in_driver_ids: filters.driverIds ?? undefined,
          in_cursor_start_datetime: cursorStartDatetime ?? undefined,
          in_cursor_id: cursorId ?? undefined,
          in_batch_size: currentBatchSize
        })
        .single();

      data = result.data;
      error = result.error;

      if (!error) {
        break;
      }

      if (isStatementTimeout(error) && currentBatchSize > MIN_BATCH_SIZE) {
        currentBatchSize = Math.max(Math.floor(currentBatchSize / 2), MIN_BATCH_SIZE);
        continue;
      }

      throw error;
    }

    const batch = data as PolicyStatsBatchRow | null;
    if (!batch) {
      break;
    }

    totalTrips += toNumber(batch.batch_trips);
    totalDistance += toNumber(batch.sum_distance);
    totalCharges += toNumber(batch.sum_charges);
    totalPay += toNumber(batch.sum_pay);
    totalTips += toNumber(batch.sum_tips);
    totalDuration += toNumber(batch.sum_duration);

    if (!batch.has_more || !batch.next_cursor_id) {
      break;
    }

    cursorStartDatetime = batch.next_cursor_start_datetime;
    cursorId = batch.next_cursor_id;
  }

  const totalTripsDivisor = totalTrips || 1;
  const totalHours = totalDuration / 3600;
  const totalHoursDivisor = totalHours || 1;

  return {
    total_trips: totalTrips,
    avg_distance: totalTrips === 0 ? 0 : totalDistance / totalTripsDivisor,
    avg_charge: totalTrips === 0 ? 0 : totalCharges / totalTripsDivisor,
    avg_charge_no_tip: totalTrips === 0 ? 0 : (totalCharges - totalTips) / totalTripsDivisor,
    avg_hourly_rate: totalHours === 0 ? 0 : totalPay / totalHoursDivisor,
    avg_hourly_rate_no_tip: totalHours === 0 ? 0 : (totalPay - totalTips) / totalHoursDivisor,
    avg_pay: totalTrips === 0 ? 0 : totalPay / totalTripsDivisor,
    avg_pay_no_tip: totalTrips === 0 ? 0 : (totalPay - totalTips) / totalTripsDivisor
  };
}
