import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * User ids of everyone who is not a worker: organizers (any organization
 * membership) and users holding a platform role other than `driver`
 * (researchers, admins, the legacy `organizer` value). Workers never get a
 * `user_roles` row in app code, so "has a role or a membership" is the reliable
 * way to tell staff apart from drivers when listing profiles.
 */
export async function staffUserIds(supabase: SupabaseClient): Promise<string[]> {
  const [{ data: roleRows, error: roleError }, { data: memberRows, error: memberError }] =
    await Promise.all([
      supabase.from('user_roles').select('user_id').neq('role', 'driver'),
      supabase.from('organization_members').select('user_id')
    ]);
  if (roleError) console.error('Failed to load platform roles for staff filter', roleError);
  if (memberError) console.error('Failed to load memberships for staff filter', memberError);

  const ids = new Set<string>();
  for (const row of roleRows ?? []) ids.add(row.user_id);
  for (const row of memberRows ?? []) ids.add(row.user_id);
  return [...ids];
}

/** PostgREST `in` filter value for `.not('user_id', 'in', …)`. */
export function notInFilter(ids: string[]): string {
  return `(${ids.map((id) => `"${id}"`).join(',')})`;
}
