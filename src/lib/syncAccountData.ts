import { supabase } from '@src/lib/server/db';
import { getActivities, addAccountToActivities } from '@src/lib/server/argyle';

/**
 * Updates all of the activities for an arygle account.
 * Optionally also updates the all_gigs_last_synced_at field.
 *
 * @param argyleAccount The argyle account to sync. This is the UUID from Argyle.
 * @param shouldUpdateAllGigsLastSyncedAt Whether or not to update the all_gigs_last_synced_at field. Defaults to true.
 */
const syncAccountData = async (
  argyleAccount: string,
  shouldUpdateAllGigsLastSyncedAt = true
): Promise<void> => {
  const activities = await getActivities({
    account: argyleAccount,
    limit: -1
  });
  const activitiesWithUser = await addAccountToActivities(activities, argyleAccount);

  const { error: activityUpsertError } = await supabase
    .from('argyle_driver_activities')
    .upsert(activitiesWithUser);
  if (activityUpsertError) {
    console.error(activityUpsertError);
    console.log('Could not save activities to supabase: ', activityUpsertError);
    throw activityUpsertError;
  }

  if (shouldUpdateAllGigsLastSyncedAt) {
    // update the all_gigs_last_synced_at field
    const { error: updateError } = await supabase
      .from('argyle_accounts')
      .update({ all_gigs_last_synced_at: new Date() })
      .eq('argyle_account', argyleAccount);
    if (updateError) {
      console.error(updateError);
      console.log('Could not update all_gigs_last_synced_at: ', updateError);
      throw updateError;
    }
  }
};

export default syncAccountData;
