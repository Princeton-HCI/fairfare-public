import { supabase } from '@src/lib/server/db';

// This is one of the demo phone numbers from the Argyle sandbox accounts
const DEMO_USER_PHONENUMBER = '18009000010';

/**
 * Get the Argyle user ID for the demo user
 * @returns {Promise<string>} The Argyle user ID
 */
const getArgyleUserIdForDemoUser = async () => {
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles')
    .select('argyle_user') // Select only the argyle_user field
    .eq('phone', DEMO_USER_PHONENUMBER) // Match the email to the test user's email
    .single(); // Ensure a single record is returned

  if (profileError || !userProfile) {
    throw new Error(
      `Failed to retrieve user profile: ${profileError?.message || 'No profile found'}`
    );
  }
  return userProfile.argyle_user;
};

export { getArgyleUserIdForDemoUser };
