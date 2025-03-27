import { toast } from '@src/lib/toasts';
import { supabase } from '@src/lib/client/db';
import { argyleAccounts } from '@src/lib/stores/argyleAccounts';
import { UserDoesNotExistError } from '../errors';

/**
 * This method will create an Argyle user account if one does not already exist.
 * It will then log that user in and update the relevant stores.
 *
 * This should be executed as one of the first steps in the sign up flow,
 * as the account is a prerequesite for setting the organization affiliations,
 * data sharing preferences, and for creating the Argyle accounts.
 */
export const createUserAccountIfMissing = async () => {
  const { data } = await supabase.auth.getSession();

  // get the argyle account from the store
  const currentArgyleAccount = argyleAccounts.get();

  if (!data.session || !currentArgyleAccount.userId || !currentArgyleAccount.token) {
    try {
      const resp = await fetch('/api/driver/argyle/users', { method: 'POST' });
      const data = await resp.json();

      // here we get back the argyle info and the session
      const { session, argyleUserId, argyleUserToken } = data;

      // log the user in
      const {
        data: { user },
        error
      } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      if (error) {
        console.error('error creating a new user:', error);
        toast({ text: 'Something went wrong. Please try again.', type: 'error' });
        return null;
      }

      // update the stores
      argyleAccounts.setUserId(argyleUserId);
      argyleAccounts.setToken(argyleUserToken);

      console.log('new user logged in and stores updated');
      return user;
    } catch (error) {
      console.error('error logging in new user:', error);
      toast({ text: 'Something went wrong. Please try again.', type: 'error' });
      throw error;
    }
  } else {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      throw new UserDoesNotExistError('No user found');
    }

    console.log('user already logged in with argyle user id:', currentArgyleAccount.userId);
    return user;
  }
};
