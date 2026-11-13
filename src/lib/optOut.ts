import { supabase } from '@src/lib/server/db';
import type { Database } from './schema';
import type { PostgrestError } from '@supabase/supabase-js';
import { sendOptOutEmailToAffiliateOrganization } from './email';
import { isDemoMode } from '@src/lib/utils';

// Type for the joined data from the consent query
type ConsentWithOrganization = {
  affiliate_organization_id: string;
  affiliate_organizations: Pick<
    Database['public']['Tables']['affiliate_organizations']['Row'],
    'id' | 'name' | 'data_deletion_contact_email'
  >;
};

const optOut = async (userId: string) => {
  /**
   * Deletes a user's data and account from the database for when they opt out.
   * If the user had consented to data sharing with organizations, sends SMS notifications
   * to those organizations' data_deletion_contact_email emails.
   *
   * @param userId - The user's id.
   * @returns The id of the new opt_out_survey_responses record.
   */

  // Check if user has consented to data sharing with any organizations
  const { data: consents, error: consentsError } = (await supabase
    .from('driver_affiliate_organization_data_sharing_consents')
    .select(
      `
      affiliate_organization_id,
      affiliate_organizations!inner(
        id,
        name,
        data_deletion_contact_email
      )
    `
    )
    .eq('user_id', userId)) as {
    data: ConsentWithOrganization[] | null;
    error: PostgrestError | null;
  };

  if (consentsError) throw consentsError;

  // get the user's full name
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('first_name, last_initial, phone')
    .eq('user_id', userId)
    .single();
  if (userError) throw userError;

  // Send email notifications to organizations that had data sharing consent
  // Skip in demo mode - no real organizations to notify
  if (!isDemoMode && consents && consents.length > 0) {
    const notificationPromises = consents
      .filter((consent) => consent.affiliate_organizations?.data_deletion_contact_email)
      .map(async (consent) => {
        const consentedToAffiliateOrganization = consent.affiliate_organizations;
        try {
          await sendOptOutEmailToAffiliateOrganization(
            consentedToAffiliateOrganization.data_deletion_contact_email!,
            user?.first_name || '',
            user?.last_initial || '',
            user?.phone || ''
          );
        } catch (error) {
          console.error(
            `Failed to send data deletion notification to organization ${consentedToAffiliateOrganization.name}:`,
            error
          );
          // Don't throw here - we want to continue with the opt-out process even if notifications fail
        }
      });

    // Wait for all notifications to be sent (or fail)
    await Promise.allSettled(notificationPromises);
  }

  // delete user
  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteUserError) throw deleteUserError;

  // write to the opt_out table
  const { data: optOutSurveyData, error: optOutError } = await supabase
    .from('opt_out_survey_responses')
    .insert({})
    .select()
    .single();

  if (optOutError) throw optOutError;
  if (!optOutSurveyData) throw new Error('optOutSurveyData is undefined');

  return optOutSurveyData.id;
};

export default optOut;
