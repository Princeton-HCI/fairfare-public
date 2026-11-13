import { supabase as serverSupabase } from '@src/lib/server/db';
import { requireAdminPage } from '@src/lib/server/adminAuth';

/** Resolve a `{ count: 'exact', head: true }` query to a number. */
const countOf = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;

const headCount = (table: 'affiliate_organizations' | 'profiles' | 'argyle_accounts') =>
  serverSupabase.from(table).select('*', { count: 'exact', head: true });

/**
 * Organizer access comes from `organization_members`; the legacy platform value
 * `user_roles.role = 'organizer'` is not written for members created by admins
 * and is overwritten for researchers, so it under-counts. Count distinct
 * members instead.
 */
async function countOrganizers() {
  const { data, error } = await serverSupabase.from('organization_members').select('user_id');
  if (error) console.error('Error counting organizers:', error);
  return new Set((data ?? []).map((row) => row.user_id)).size;
}

export async function load({ locals }) {
  await requireAdminPage(locals);

  const [
    activeOrganizations,
    deletedOrganizations,
    organizers,
    profiles,
    connectedAccounts,
    syncedAccounts
  ] = await Promise.all([
    countOf(headCount('affiliate_organizations').eq('status', 'active')),
    countOf(headCount('affiliate_organizations').eq('status', 'deleted')),
    countOrganizers(),
    countOf(headCount('profiles')),
    countOf(headCount('argyle_accounts').is('deleted_at', null)),
    countOf(
      headCount('argyle_accounts').is('deleted_at', null).not('all_gigs_last_synced_at', 'is', null)
    )
  ]);

  return {
    stats: {
      activeOrganizations,
      deletedOrganizations,
      organizers,
      profiles,
      connectedAccounts,
      syncedAccounts
    }
  };
}
