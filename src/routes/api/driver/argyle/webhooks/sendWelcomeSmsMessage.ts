import sendSmsMessageToUserNow from '@src/lib/smsMessages/sendSmsMessageToUserNow';
import { supabase } from '@lib/server/db';

type Profile = SupabaseRows['profiles'];

const getUserDataSharingConsentOrganizationName = async (
  user_id: string
): Promise<string | undefined> => {
  const { data: userDataSharingConsents, error } = await supabase
    .from('driver_affiliate_organization_data_sharing_consents')
    .select('affiliate_organizations ( name )')
    .eq('user_id', user_id);
  if (error) throw error;
  // @ts-expect-error This comes back like [{ affiliate_organizations: { name: 'EDL' } }]
  return userDataSharingConsents.map((consent) => consent.affiliate_organizations.name).join(', ');
};

/**
 * Sends a welcome message to the user.
 *
 * If a user has consented to share their data with organizations, we send
 * a message that includes the organization name so it is clear that they
 * are sharing their data.
 *
 * Otherwise, we send a generic welcome message.
 *
 * If the message template is a duplicate, we ignore it.
 *
 * @param profile The user profile to send the message to
 * @param loggingContext A string to include in log messages
 */
const sendWelcomeSmsMessage = async (profile: Profile, loggingContext: string) => {
  const dataSharingConsentOrganizationName = await getUserDataSharingConsentOrganizationName(
    profile.user_id
  );
  try {
    if (dataSharingConsentOrganizationName) {
      await sendSmsMessageToUserNow(profile.user_id, 'welcome_with_data_sharing_consent', {
        organizationName: dataSharingConsentOrganizationName
      });
      console.log(
        `'[${loggingContext}] Sent welcome_with_data_sharing_consent message to user ${profile.user_id}.`
      );
    } else {
      await sendSmsMessageToUserNow(profile.user_id, 'welcome', {});
      console.log(`'[${loggingContext}] Sent welcome message to user ${profile.user_id}.`);
    }
  } catch (error: unknown) {
    const errorMessage = (error as Error).message;
    if (
      errorMessage ===
      'duplicate key value violates unique constraint "unique_phone_number_message_template_id"'
    ) {
      // Ignore duplicate message templates, this happens since we have several
      // webhooks try to send the same message.
      return;
    } else {
      throw error;
    }
  }
};

export default sendWelcomeSmsMessage;
