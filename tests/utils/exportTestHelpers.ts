import { supabase } from '@src/lib/server/db';

/**
 * Fixtures for `policy_analysis_exports` rows.
 *
 * The mock `RequestEvent` builders that used to live here moved to
 * tests/utils/requestEvent.ts, where every endpoint spec can reach them.
 */

/**
 * Inserts an export record directly via the service-role client. Returns the inserted row.
 */
export async function insertExportRecord(overrides: {
  user_id: string;
  organization_key?: string;
  status?: string;
  filters?: Record<string, unknown>;
  total_rows?: number;
  file_path?: string;
  error_message?: string;
  read_at?: string | null;
  created_at?: string;
}) {
  const row = {
    organization_key: 'all',
    status: 'pending',
    filters: { startDate: null, endDate: null, location: null, driverIds: null },
    total_rows: 0,
    ...overrides
  };

  const { data, error } = await supabase
    .from('policy_analysis_exports')
    .insert(row)
    .select('*')
    .single();

  if (error) throw new Error(`insertExportRecord failed: ${error.message}`);
  return data;
}

/**
 * Deletes all export records for a given user.
 */
export async function cleanupExports(userId: string) {
  await supabase.from('policy_analysis_exports').delete().eq('user_id', userId);
}
