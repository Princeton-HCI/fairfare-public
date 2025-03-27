import { UserDoesNotExistError } from '@src/lib/errors';
import type { WebhookUsersFullySynced } from './types';
import syncAccountData from '@src/lib/syncAccountData';

/*
 * This function processes the a full sync from Argyle based on an Argyle webhook response.
 * It saves the activities to the database and returns the phone, user, and argyle_user.
 */
const processFullSync = async (response: WebhookUsersFullySynced) => {
  console.log('[processFullSync] Syncing', response.data.user, '...');

  const {
    data: {
      resource: { accounts_connected }
    }
  } = response;

  const getActivitiesResults: {
    argyle_account: string;
    success: boolean;
  }[] = [];

  console.log('Found', accounts_connected.length, 'accounts connected');

  const accountPromises = accounts_connected.map(async (account: string) => {
    try {
      await syncAccountData(account);

      getActivitiesResults.push({
        argyle_account: account,
        success: true
      });
    } catch (error) {
      if (error instanceof UserDoesNotExistError) {
        // don't log
      } else {
        // log
        console.error('Error processing account', account, error);
      }
      getActivitiesResults.push({
        argyle_account: account,
        success: false
      });
    }
  });

  await Promise.all(accountPromises);

  if (getActivitiesResults.length === 0) {
    throw new Error('No accounts connected on full sync');
  }
};

export default processFullSync;
