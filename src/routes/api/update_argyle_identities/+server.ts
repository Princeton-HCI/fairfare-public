import {
  addIdentityDataToUserAndEnableOtpLogin,
  fetchIdentityByUser
} from '@src/lib/server/argyle';
import { supabase } from '@src/lib/server/db';
import { validateInternalApiKey } from '@src/lib/server/internalAuth';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { UserDoesNotExistError } from '@src/lib/errors';

export const POST = async ({ request }: RequestEvent) => {
  validateInternalApiKey(request);
  const { data: profilesWithMissingData, error: supabaseError } = await supabase
    .from('profiles')
    .select('*')
    .or('email.is.null, first_name.is.null, last_initial.is.null')
    .not('argyle_user', 'is', null)
    .not('user_id', 'is', null);

  if (supabaseError) {
    console.error(supabaseError);
    throw error(500, 'Selecting profiles with missing data failed.');
  }

  if (profilesWithMissingData.length === 0) {
    console.log(
      'No users with (a) missing data and (b) a present argyle_user id and (c) a present user_id found.'
    );
    return json({ success: true });
  }

  console.log(
    'Found ' +
      profilesWithMissingData.length +
      ' users with (a) missing data and (b) a present argyle_user id and (c) a present user_id.'
  );

  const userIdsWithMissingData = profilesWithMissingData.map((profile) => profile.user_id);

  console.log('userIdsWithMissingData', userIdsWithMissingData);

  const numberOfProfilesToAttempt = profilesWithMissingData.length;

  const noIdentitiesFoundUserIds = [];
  const updatingProfileFailedUserIds = [];

  // iterate over the users and update their identities
  await Promise.all(
    profilesWithMissingData.map(async (profile) => {
      const responseData = { results: await fetchIdentityByUser(profile.argyle_user) };

      // if the user has no identities
      if (responseData.results.length === 0) {
        console.log(
          'No identities found for user: returned empty array. user_id: ' + profile.user_id
        );
        noIdentitiesFoundUserIds.push(profile.user_id);
        return; // go to the next user
      }

      try {
        await addIdentityDataToUserAndEnableOtpLogin(profile.argyle_user, responseData.results[0]);
        console.log('Added identity data to user: ' + profile.user_id);
      } catch (error) {
        // here!
        if (error instanceof UserDoesNotExistError) {
          console.log(
            '[update_argyle_identites] Argyle account not in database, exiting:',
            profile.argyle_user
          );
          return;
        }

        const errorMessage = (error as Error).message;
        if (
          errorMessage ===
            'duplicate key value violates unique constraint "users_email_partial_key"' ||
          errorMessage === 'duplicate key value violates unique constraint "users_phone_key"'
        ) {
          console.log(
            'Failed to add identity data to user: ' +
              profile.user_id +
              ' because they have two argyle identites with the same email/phone. Argyle user: ' +
              profile.argyle_user
          );
          return;
        }

        console.log('Failed to add identity data to user: ' + profile.user_id);
        updatingProfileFailedUserIds.push(profile.user_id);
        console.error('Failed to add identity data to user: ' + profile.user_id);
        console.error(error);
        // throw e;
      }
    })
  );

  console.log(
    'success:',
    numberOfProfilesToAttempt -
      noIdentitiesFoundUserIds.length -
      updatingProfileFailedUserIds.length,
    'update_argyle_identities summary:',
    numberOfProfilesToAttempt,
    'attempts.',
    noIdentitiesFoundUserIds.length,
    'users had no identities found.',
    updatingProfileFailedUserIds.length,
    'users failed to update.'
  );

  return json({ success: true });
};
