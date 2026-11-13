import { supabase } from '@src/lib/server/db';
import { getFlattenedArgyleGigs, addAccountToActivities } from '@src/lib/server/argyle';
import type { ResolvedArgyleCredentials } from '@src/lib/server/organizationArgyle';

interface SyncAccountDataOptions {
  shouldUpdateAllGigsLastSyncedAt?: boolean;
  credentials?: ResolvedArgyleCredentials | null;
}

/**
 * Updates all of the activities for an argyle account.
 * Optionally also updates the all_gigs_last_synced_at field.
 */
const syncAccountData = async (
  argyleAccount: string,
  options?: SyncAccountDataOptions | boolean
): Promise<void> => {
  const normalized: SyncAccountDataOptions =
    typeof options === 'boolean' ? { shouldUpdateAllGigsLastSyncedAt: options } : (options ?? {});
  const { shouldUpdateAllGigsLastSyncedAt = true, credentials } = normalized;

  const flattenedGigs = await getFlattenedArgyleGigs({
    account: argyleAccount,
    limit: -1,
    credentials
  });
  const activitiesWithUser = await addAccountToActivities(flattenedGigs, argyleAccount);

  const { error: activityUpsertError } = await supabase
    .from('argyle_driver_activities')
    .upsert(activitiesWithUser);
  if (activityUpsertError) {
    console.error(activityUpsertError);
    throw activityUpsertError;
  }

  if (shouldUpdateAllGigsLastSyncedAt) {
    const { error: updateError } = await supabase
      .from('argyle_accounts')
      .update({ all_gigs_last_synced_at: new Date() })
      .eq('argyle_account', argyleAccount);
    if (updateError) {
      console.error(updateError);
      throw updateError;
    }
  }
};

export default syncAccountData;
