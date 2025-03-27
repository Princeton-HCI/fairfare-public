import {
  addIdentityDataToUserAndEnableOtpLogin,
  fetchAccount,
  fetchIdentity,
  fetchIdentityByUser
} from '@src/lib/server/argyle';

import { supabase } from '@src/lib/server/db';
import syncAccountData from '@src/lib/syncAccountData';

import processFullSync from './processFullSync';
import handlePostSync from './handlePostSync';
import sendWelcomeSmsMessage from './sendWelcomeSmsMessage';
import handleDuplicateUser from './handleDuplicateUser';

import type { ArgyleWebhookResponse } from './types';
import { UserDoesNotExistError } from '@src/lib/errors';

// error for WriteToReceivedArgyleWebhooksError
class WriteToReceivedArgyleWebhooksError extends Error {
  error: Error;
  constructor(error: Error) {
    super('Could not write to received_argyle_webhooks');
    this.name = 'WriteToReceivedArgyleWebhooksError';
    this.error = error;
  }
}

const writeWebhookToReceivedArgyleWebhooks = async (response: ArgyleWebhookResponse) => {
  const { error } = await supabase
    .from('received_argyle_webhooks')
    .insert({ response, received_at: new Date().toISOString() });

  if (error) {
    console.error('Could not write to received_argyle_webhooks:', error, response);
    throw new WriteToReceivedArgyleWebhooksError(error);
  }
};

const trySyncingAccountData = async (
  argyleAccount: string,
  shouldUpdateAllGigsLastSyncedAt = true
) => {
  try {
    await syncAccountData(argyleAccount, shouldUpdateAllGigsLastSyncedAt);
  } catch (error) {
    if (error instanceof UserDoesNotExistError) {
      console.log('[users.fully_synced] Argyle account not in database, exiting:', argyleAccount);
      return;
    }
    throw error;
  }
};

/**
 * This has been significantly refactored on 2024-09-13 to change the way
 * that we work with webhooks. The following webhooks are handled in the
 * following ways:
 *
 * 1. `accounts.updated`: This is sent when an account is updated. We check
 * if the account has an employer, and if it does, we add the employer to
 * the `argyle_account` in the database.
 *
 * 2. `accounts.connected`: This is sent when a user submits credentials
 * through the Link interface. This is the first webhook to be sent when
 * a new user signs up. If the user does not exist in the database, we
 * create a user for them. We then add an `argyle_account` to the database
 * corresponding to the user, `argyle_user`, and `argyle_account` values.
 *
 * 3. `identities.added`: This is the first opportunity to get a user's
 * account information, such as their phone number. Upon receiving this
 * webhook, we fetch the user's identity data and add it to the user's
 * metadata.
 *
 * 4. `identities.updated`: This is sent when a user's identity is updated.
 * We update the user's metadata with the new identity data. We also check
 * if the phone number has changed; if it has, we send a welcome message to
 * the new phone number.
 *
 * 5. `gigs.partially_synced`: This is sent when 30 days of gig data has been
 * synced. We sync all of the gig data and send a survey invitation to the user.
 *
 * 6. `users.fully_synced`: This is sent when all data has been fully synced
 * for a user. This includes all of the user's accounts. When this webhook is
 * sent, we can consider that all of the user's data is now present in Argyle.
 * We sync all of the user's activities and send a survey message to the user.
 *
 * Note: the `gigs.added` and `gigs.updated` webhooks sync account data alongside
 * nightly updates to ensure data is up to date.
 *
 * See: https://docs.argyle.com/api-reference/accounts-webhooks
 * See: https://docs.argyle.com/api-reference/gigs-webhooks
 * See: https://docs.argyle.com/api-reference/users-webhooks
 *
 * @param response The webhook response from Argyle
 * @returns A response object with a success message if the webhook was handled successfully
 */
export async function handleWebhook(response: ArgyleWebhookResponse) {
  try {
    await writeWebhookToReceivedArgyleWebhooks(response);
  } catch (e) {
    if (e instanceof WriteToReceivedArgyleWebhooksError) {
      console.error('Could not write to received_argyle_webhooks:', e.error);
      // let this continue even if this is the error
    }
  }

  switch (response.event) {
    case 'accounts.connected': {
      console.log('[accounts.connected] Connected:', response.data.account);
      const {
        data: { user: argyleUser, account: argyleAccount }
      } = response;

      const { data: userProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('argyle_user', argyleUser);

      if (profilesError) {
        throw new Error('Could not get user: ' + profilesError.message);
      }
      if (userProfiles.length === 0) {
        console.log('[accounts.connected] User profile not found, exiting:', argyleUser);
        return;
      }
      if (userProfiles.length > 1) {
        console.error('[accounts.connected] Multiple user profiles found, exiting:', argyleUser);
        return;
      }

      if (userProfiles === null) {
        throw new Error('Could not get user: no profile matches argyle_user ' + argyleUser + '.');
      }

      const userId = userProfiles[0].user_id; // set the userId

      if (!userId) {
        throw new Error('Could not find user; no id');
      }

      const { error: newAccountError } = await supabase
        .from('argyle_accounts')
        .upsert(
          { argyle_user: argyleUser, argyle_account: argyleAccount, user_id: userId },
          {
            onConflict: 'argyle_user, argyle_account',
            ignoreDuplicates: true
          }
        )
        .select('*');

      if (newAccountError) {
        console.log(newAccountError);
        throw new Error('Could not add account to argyle_accounts: ' + newAccountError.message);
      }
      break;
    }
    case 'accounts.updated': {
      // Here we can add the employer to the account
      const { account: updatedAccountId, user: updatedUserId } = response.data;
      const accountData = await fetchAccount(updatedAccountId);

      if (!accountData) {
        console.warn('[accounts.updated] Account not found on argyle:', updatedAccountId);
        return;
      }

      // if employers is empty, do nothing
      if (!accountData.employers) {
        break;
      }

      const employer = accountData.employers[0];
      // update argyle_accounts matching id and account with employer
      const { error: updatedAccountError } = await supabase
        .from('argyle_accounts')
        .update({ employer: employer })
        .eq('argyle_account', updatedAccountId)
        .eq('argyle_user', updatedUserId)
        .select('*');

      // Failsafe to ensure that the user has had a full sync even if the gigs
      // webhooks don't fire. This is implemented on 2024-11-27, based on the
      // discovery that not all of the expected webhooks are sent to us. We are
      // reliably sent the `accounts.updated` webhook, so we can use this to
      // ensure that the user has had a full sync.
      if (accountData.availability?.gigs?.status === 'synced') {
        // if the account has never had a full update, then
        const argyleAccountId = response.data.account;
        const { data: argyleAccounts, error: getArgyleAccountError } = await supabase
          .from('argyle_accounts')
          .select('*')
          .eq('argyle_account', argyleAccountId);

        if (getArgyleAccountError) {
          throw new Error('Could not find argyle account: ' + getArgyleAccountError.message);
        }
        if (argyleAccounts.length === 0) {
          // same as UserDoesNotExistError
          console.log('[accounts.updated] Account not found, exiting:', argyleAccountId);
          return;
        }
        if (argyleAccounts.length > 1) {
          console.error('[accounts.updated] Multiple accounts found, exiting:', argyleAccountId);
          return;
        }

        if (!argyleAccounts[0].all_gigs_last_synced_at) {
          // pull in the gigs
          // this auto-updates the all_gigs_last_synced_at value
          await trySyncingAccountData(argyleAccountId);

          // send the right type of sms (if necessary) if it's not already sent
          await handlePostSync(response.data.user);
        }
      }

      // This is the same as the failsafe above -- we want to ensure that the
      // user's identities are up to date, but we don't always see the identity
      // webhooks fire in production. This is implemented on 2024-11-27.
      if (accountData.availability?.identities?.status === 'synced') {
        const { user: argyleUserId } = response.data;
        const identities = await fetchIdentityByUser(argyleUserId);

        // assuming the first identity
        const identity = identities[0].id;

        const identityData = await fetchIdentity(identity);
        try {
          const updatedProfile = await addIdentityDataToUserAndEnableOtpLogin(
            argyleUserId,
            identityData
          );
          if (updatedProfile && updatedProfile.phone) {
            await sendWelcomeSmsMessage(updatedProfile, 'accounts.updated');
          } else {
            console.error('[accounts.updated] Could not add identity to user profile');
          }
        } catch (error) {
          if (error instanceof UserDoesNotExistError) {
            console.log('[accounts.updated] User not in database, exiting:', argyleUserId);
            return;
          }
          throw error;
        }
      }

      if (updatedAccountError) {
        console.error('Could not update account:', updatedAccountError);
        throw new Error('Could not update account: ' + updatedAccountError.message);
      }
      break;
    }
    case 'identities.added': {
      const { identity, user: argyleUserId } = response.data;
      const identityData = await fetchIdentity(identity);
      try {
        const updatedProfile = await addIdentityDataToUserAndEnableOtpLogin(
          argyleUserId,
          identityData
        );
        if (updatedProfile && updatedProfile.phone) {
          await sendWelcomeSmsMessage(updatedProfile, 'identities.added');
        } else {
          console.error('Could not add identity to user profile: no phone number');
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        // Here we handle cases where we try to add a user that already has an account;
        // we handle these with the handleDuplicateUser function, which notifies the user
        // and deletes the duplicate account.
        if (
          errorMessage ===
          'duplicate key value violates unique constraint "users_email_partial_key"'
        ) {
          await handleDuplicateUser(argyleUserId, identityData, 'email');
          // throw new Error('User already exists with this email address');
        } else if (
          errorMessage === 'duplicate key value violates unique constraint "users_phone_key"'
        ) {
          await handleDuplicateUser(argyleUserId, identityData, 'phone');
          // throw new Error('User already exists with this phone number');
        } else {
          throw error;
        }
      }
      break;
    }
    case 'identities.updated': {
      // Here we check if the phone number has changed.
      // If it has, we send a welcome message.
      const { identity: newIdentity, user: newUser } = response.data;
      // get identity from argyle API
      const newIdentityData = await fetchIdentity(newIdentity);

      const { data: profile, error: supabaseFindUserError } = await supabase
        .from('profiles')
        .select('*')
        .eq('argyle_user', newUser)
        .single();

      if (supabaseFindUserError) {
        console.log('[users.fully_synced] User not in database, exiting:', response.data.user);
        return;
      }

      if (profile) {
        const oldPhone = profile.phone || '';
        const newProfileWithIdentityData = await addIdentityDataToUserAndEnableOtpLogin(
          newUser,
          newIdentityData
        );
        const newPhone = newProfileWithIdentityData?.phone;

        // This fixes mismatches like +1 (123) 456-7890 and 123-456-7890
        const numbersOnly = (phone: string) => phone.replace(/\D/g, '');

        if (newPhone && oldPhone && numbersOnly(newPhone) !== numbersOnly(oldPhone)) {
          console.log(
            `Phone number changed from ${oldPhone} to ${newPhone}. Sending welcome message to user ${newProfileWithIdentityData?.user_id}...`
          );
          if (!newProfileWithIdentityData?.user_id) {
            throw new Error('iuUpdatedUser not found in identities_updated webhook handling');
          }
          await sendWelcomeSmsMessage(newProfileWithIdentityData, 'identities.updated');
        }
      }
      break;
    }
    case 'gigs.partially_synced': {
      // This means 30 days of gigs have been synced.
      // We want to pull all of the data and send the survey invitation.
      // This does **not** update the all_gigs_last_synced_at value on the account.
      await trySyncingAccountData(response.data.account, false);
      await handlePostSync(response.data.user);
      break;
    }
    case 'gigs.added':
      // Sync the account data
      // Here we do set the all_gigs_last_synced_at value on the account.

      // Via: https://docs.argyle.com/api-reference/gigs-webhooks#added
      // "The gigs.added webhook is sent only when an account's data is refreshed
      // (does not include initial data retrieval) and a new gig is retrieved."
      await trySyncingAccountData(response.data.account, true);
      break;
    case 'gigs.updated':
      // Sync the account data
      // Here we do **not** set the all_gigs_last_synced_at value on the account.

      // Via: https://docs.argyle.com/api-reference/gigs-webhooks#updated
      // "The gigs.updated webhook is sent when there is any change to a property
      // value of the gig object. For example, after a gig assignment is completed
      // the gig object's status value changes from in_progress to completed."
      await trySyncingAccountData(response.data.account, false);
      break;
    case 'users.fully_synced':
      // The users.fully_synced webhook is sent when all data has been fully
      // retrieved from all payroll accounts a user connected through Link.
      // This also updates the all_gigs_last_synced_at on this user's accounts.
      try {
        await processFullSync(response);

        // Here we have some branching logic based on the study_participation
        // about what to do when the syncing is completed. This is handled in
        // the handlePostSync method.
        await handlePostSync(response.data.user);
      } catch (error) {
        if (error instanceof UserDoesNotExistError) {
          console.log('[users.fully_synced] User not in database, exiting:', response.data.user);
          return;
        }
        throw error;
      }
      break;
  }
}
