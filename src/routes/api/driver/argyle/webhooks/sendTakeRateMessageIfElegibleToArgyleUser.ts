import { UserDoesNotExistError } from '@src/lib/errors';
import { supabase } from '@src/lib/server/db';
import sendSmsMessageNow from '@src/lib/smsMessages/sendSmsMessageNow';

import short from 'short-uuid';

/**
 * Takes the Argyle user ID, looks up the user, and returns the link to the
 * user's data page, using the Supabase user ID, *not* the Argyle user ID.
 *
 * NB: the ID in the link is a short UUID to the Supabase user ID.
 *
 * @param argyleUserId - the Argyle user ID
 * @returns the link to the user's data page
 */

const getDriverDataLinkFromArgyleUserId = async (
  argyleUserId: string,
  baseUrl: string = 'https://www.getsystem.org/'
): Promise<string> => {
  // get the user id here!
  const { data: userProfile, error: userError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('argyle_user', argyleUserId)
    .single();

  if (userError) {
    console.error('Error getting user id from argyle user:', userError);
    throw userError;
  }

  if (!userProfile) {
    console.error('Error getting user id from argyle user: no user found');
    throw new Error('No user found for argyle user ' + argyleUserId);
  }

  const userId = userProfile.user_id;
  const translator = short();
  const shortUserId = translator.fromUUID(userId);

  return `${baseUrl}driver/data/${shortUserId}`;
};

const checkSurveyEligibility = async (userId: string) => {
  /**
   * Check if a user is elegible to take the survey
   *
   * Criteria:
   * - User has more than 10 trips
   * - User's trips span at least one month
   */
  const { data: activityData, error: activityError } = await supabase
    .from('argyle_driver_activities')
    .select('*')
    .eq('user', userId);

  const { data: surveyData, error: surveyError } = await supabase
    .from('survey_fair_take_rate')
    .select('*')
    .eq('user_id', userId);

  if (activityError || surveyError) {
    console.error('Error checking survey eligibility:', activityError, '|', surveyError);
    return false;
  }

  if (activityData == null) {
    console.error('Error checking survey eligibility: no activities returned');
    return false;
  }

  if (activityData.length < 10) {
    console.log('User has less than 10 trips, not eligible for survey');
    return false;
  }

  if (surveyData && surveyData.length > 0) {
    console.log('User has already filled out this survey, not eligible.');
    return false;
  }

  return true;
};

/**
 * Sends the take rate survey to a user if they are eligible
 *
 * Criteria:
 * - User has more than 10 trips
 * - User's trips span at least one month
 *
 * @param phone - the user's phone number
 * @param userId - the user's id
 * @param argyleUserId - the user's argyle id
 * @returns void
 */
const sendTakeRateMessageIfElegible = async (
  phone: string,
  userId: string,
  argyleUserId: string
) => {
  // check that all params are defined
  if (!phone || !userId || !argyleUserId) {
    throw Error('Missing required parameters');
  }
  const isElegible = await checkSurveyEligibility(userId);
  const driverDataLink = await getDriverDataLinkFromArgyleUserId(argyleUserId);
  if (isElegible) {
    try {
      await sendSmsMessageNow({
        messageTemplateKey: 'view_take_rate',
        messageArguments: {
          driverDataLink
        },
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
  }
};

const sendTakeRateMessageIfElegibleToArgyleUser = async (argyleUser: string) => {
  const { data: profiles, error: userProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('argyle_user', argyleUser);

  if (userProfileError) {
    throw new Error('Could not find argyle account: ' + userProfileError.message);
  }
  if (profiles.length === 0) {
    throw new UserDoesNotExistError('Could not find user with argyle_user ' + argyleUser);
  }
  if (profiles.length > 1) {
    console.error(
      '[sendTakeRateMessageIfElegibleToArgyleUser] Multiple accounts found in argyle_accounts, exiting:',
      argyleUser
    );
    return;
  }

  const profile = profiles[0];

  if (profile.phone == null)
    throw new Error('Could not find user with a phone for argyle_user ' + argyleUser);

  if (profile.user_id == null)
    throw new Error('No supabase user found for argyle user ' + argyleUser);

  await sendTakeRateMessageIfElegible(profile.phone, profile.user_id, argyleUser);
};

export { sendTakeRateMessageIfElegibleToArgyleUser, getDriverDataLinkFromArgyleUserId };
