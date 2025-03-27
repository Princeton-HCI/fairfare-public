import { supabase } from '@src/lib/server/db';

import type { ArgyleIdentity } from '@src/lib/types';
import sendSmsMessageToUserNow from '@src/lib/smsMessages/sendSmsMessageToUserNow';

/**
 * This method should be called when handling an Argyle identities.added
 * webhook where the identityData is a duplicate of an existing user.
 *
 * A duplicate user is a user that already exists in the system with the same
 * email or phone number as the identityData.
 *
 * This method should be called as a response to duplicate values that violate
 * database uniqueness constraints.
 *
 * @param duplicateArgyleUserId The Argyle user ID of the duplicate user. Note
 *                     that this ID will be different across the records in the
 *                     Argyle system and in the profiles table.
 * @param identityData The Argyle identity data that is a duplicate.
 * @param duplicateType The type of duplicate that was found. Either 'email'
 *                      or 'phone'.
 */
const handleDuplicateUser = async (
  duplicateArgyleUserId: string,
  identityData: ArgyleIdentity,
  duplicateType: 'email' | 'phone'
) => {
  console.log(
    `Duplicate user found with ${duplicateType} ${identityData.phone_number} / ${identityData.email}. Argyle user ID: ${duplicateArgyleUserId}`
  );

  // First we'll want to find the original profile.
  // This is the profile whose user we want to keep, the original with the phone / email
  // already in the system.
  const orginalUserProfile = await getOriginalUserProfile(duplicateType, identityData);
  if (!orginalUserProfile) {
    throw new Error(
      'Error fetching original profile: ' + identityData.phone_number + ' / ' + identityData.email
    );
  }
  if (!orginalUserProfile.argyle_user) {
    throw new Error('Error fetching original profile: no Argyle user ID found');
  }

  // Now we'll get the duplicate account with the matching (incorrect) Argyle user ID
  const { data: duplicateProfile, error: duplicateProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('argyle_user', duplicateArgyleUserId)
    .single();
  if (duplicateProfileError) {
    console.error('Error fetching duplicate profile by Argyle user ID: ' + duplicateProfileError);
    throw duplicateProfileError;
  }

  // Delete the duplicate user
  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(
    duplicateProfile?.user_id
  );
  if (deleteUserError) {
    console.error('Error deleting duplicate user: ' + deleteUserError);
    throw deleteUserError;
  }

  // Here we deliberately choose not to apply the webhook to the original user.
  // This lets us adhere to the principle that our profiles map to Argyle's users.
  // If we were to apply the webhook to the original user, we would be changing the
  // Argyle user ID associated with the original user to point to the duplicate user.
  // This would, in turn, mean that we would be associating, e.g., Argyle accounts
  // and gigs with the wrong user in our system.

  // The result is that handling this webhook in our system has no effect except
  // to delete the duplicate user. This may cause 404 webhooks to be sent after
  // since the Argyle user ID is no longer associated with a user in our system.

  // Send the text message to the original user whose data has now been updated.
  await sendSmsMessageToUserNow(orginalUserProfile.user_id, 'account_already_exists', {});
};

const getOriginalUserProfile = async (
  duplicateType: 'email' | 'phone',
  identityData: ArgyleIdentity
): Promise<Profile | null> => {
  if (duplicateType === 'email') {
    // Get the duplicate profile by email
    const { data: duplicateProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', identityData.email);
    if (error) {
      console.error('Error fetching duplicate profiles by email: ' + error);
      throw error;
    }
    if (duplicateProfile.length === 0) {
      console.error('No duplicate profiles found by email');
      return null;
    }
    if (duplicateProfile.length > 1) {
      console.error('Multiple duplicate profiles found by email');
      throw new Error(
        'Multiple duplicate profiles found by email: revise this case manually:' +
          identityData.email
      );
    }

    return duplicateProfile[0];
  } else {
    const phoneNumberDigitsOnly = identityData.phone_number.replace(/\D/g, '');
    // Get the duplicate user_ids by phone number
    const { data: duplicateProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phoneNumberDigitsOnly);
    if (error) {
      console.error('Error fetching duplicate profiles by phone: ' + error.message);
      throw error;
    }
    if (duplicateProfile.length === 0) {
      console.error('No duplicate profiles found by phone number');
      return null;
    }
    if (duplicateProfile.length > 1) {
      console.error('Multiple duplicate profiles found by phone number');
      throw new Error(
        'Multiple duplicate profiles found by phone number: revise this case manually:' +
          identityData.phone_number
      );
    }

    return duplicateProfile[0];
  }
};

export default handleDuplicateUser;
