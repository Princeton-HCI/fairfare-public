import { supabase } from '@src/lib/server/db';
import { sendTakeRateMessageIfElegibleToArgyleUser } from './sendTakeRateMessageIfElegibleToArgyleUser';
import { sendThankYouMessageToArgyleUser } from './sendThankYouMessageToArgyleUser';
import { isDemoMode } from '@src/lib/utils';

type PostSyncEnum = SupabaseEnums['study_participations_post_sync'];

const checkPostSyncBehavior = async (argyleUserId: string): Promise<PostSyncEnum | null> => {
  const { data: userProfiles, error: userError } = await supabase
    .from('profiles')
    .select('study_participations( post_sync, created_at )')
    .eq('argyle_user', argyleUserId);

  if (userError) {
    console.error('user_error', userError);
    throw userError;
  }

  if (userProfiles.length === 0) {
    // No profile found for this user, so we'll send a null value
    return null;
  }

  const studyParticipations = userProfiles[0].study_participations;

  if (!studyParticipations) {
    return 'send-take-rate'; // this is also the db default
  }

  // sort the study participations by created_at, so that the newest one is first
  const sortedStudyParticipations = studyParticipations.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const oldestStudyParticipation = sortedStudyParticipations[0];
  return oldestStudyParticipation?.post_sync || 'send-take-rate';
};

const handlePostSync = async (argyleUserId: string) => {
  // In demo mode, skip sending real SMS messages entirely
  if (isDemoMode) return;

  // Check the post sync behavior that we want here
  const postSyncBehavior = await checkPostSyncBehavior(argyleUserId);

  if (postSyncBehavior === 'send-take-rate') {
    // We'll send a link to the take rate to the user.
    // The text message will never send twice because of the db constraint
    await sendTakeRateMessageIfElegibleToArgyleUser(argyleUserId);
  } else if (postSyncBehavior === 'send-thank-you') {
    // We'll send a thank you message to the user.
    // The text message will never send twice because of the db constraint
    await sendThankYouMessageToArgyleUser(argyleUserId);
  }
};

export default handlePostSync;
