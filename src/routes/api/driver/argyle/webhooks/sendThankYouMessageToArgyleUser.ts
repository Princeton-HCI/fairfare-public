import { supabase } from '@src/lib/server/db';
import sendSmsMessageNow from '@src/lib/smsMessages/sendSmsMessageNow';

/**
 * Sends a thank you message to a user who has completed a full sync.
 * Note that this is an alternative post_sync behavior to 'send-take-rate'.
 * This corresponds to the 'send-thank-you' post_sync behavior.
 *
 * @param phone - the user's phone number
 * @param userId - the user's id
 * @param argyleUserId - the user's argyle id
 * @returns void
 */
const sendThankYouMessage = async (phone: string, userId: string, argyleUserId: string) => {
  // check that all params are defined
  if (!phone || !userId || !argyleUserId) {
    throw Error('Missing required parameters');
  }
  try {
    await sendSmsMessageNow({
      messageTemplateKey: 'thank_you_sync',
      messageArguments: {},
      phoneNumber: phone
    });
  } catch (error: unknown) {
    const errorMessage = (error as Error).message;
    if (
      errorMessage ===
      'duplicate key value violates unique constraint "unique_phone_number_message_template_id"'
    ) {
      console.warn('Sending take rate survey failed: Take rate survey already sent');
      return;
    }
    console.error('Error sending take rate survey:', error);
    throw Error('Sending take rate survey failed');
  }
};

const sendThankYouMessageToArgyleUser = async (argyleUser: string) => {
  const { data: userProfile, error: user_error } = await supabase
    .from('profiles')
    .select('*')
    .eq('argyle_user', argyleUser)
    .single();

  if (userProfile?.phone == null)
    throw new Error('Could not find user with a phone for argyle_user ' + argyleUser);
  if (user_error) throw user_error;

  if (userProfile.user_id == null)
    throw new Error('No supabase user found for argyle user ' + argyleUser);

  await sendThankYouMessage(userProfile.phone, userProfile.user_id, argyleUser);
};

export { sendThankYouMessageToArgyleUser };
