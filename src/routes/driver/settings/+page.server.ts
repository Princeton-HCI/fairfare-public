import short from 'short-uuid';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from '../../$types';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';
import { supabase } from '@src/lib/server/db';
import { wrapLoadWithSentry } from '@sentry/sveltekit';
import { getUserToken, fetchAccountsByUser } from '@src/lib/server/argyle';

export const load: LayoutServerLoad = wrapLoadWithSentry(async ({ locals: { safeGetSession } }) => {
  const { user } = await safeGetSession();

  if (!user) {
    return redirect(303, '/driver/login');
  }

  const profile = await getProfileFromUserId(supabase, user.id);

  const argyleUserId = profile.argyle_user;

  if (!profile.phone) {
    throw new Error('No phone found for this user');
  }

  if (argyleUserId === null) {
    throw new Error('No Argyle user ID found for this user');
  }

  // get an argyle token for the user
  const argyleUserToken = await getUserToken(argyleUserId);

  // TODO: store this data in the database, updated based on accounts.updated
  // webhooks, saving the account.connection.status value to the database.

  // check if all of the user's argyle accounts are connected
  const argyleAccounts = await fetchAccountsByUser(argyleUserId);
  const statuses = argyleAccounts.map((account) => account.connection.status);

  // If the value of connection.status is error, and the error_message is either
  // auth_required or expired_credentials, an account disconnection has occurred.
  // see: https://docs.argyle.com/workflows/reconnecting-accounts
  const allArgyleAccountsAreConnected = statuses.every((status) => status === 'connected');

  const phoneNumberLastTwo = profile.phone.slice(-2);

  const fullName =
    profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : '(Missing Name)';

  // get the count of `argyle_driver_activities`
  const { error, count: activitiesCount } = await supabase
    .from('argyle_driver_activities')
    .select('*', { count: 'exact', head: true })
    .eq('user', user.id);

  if (error) {
    console.error('Error getting activities count', error);
    return {};
  }

  return {
    userId: user.id,
    shortUserId: short().fromUUID(user.id),
    phoneNumberLastTwo: phoneNumberLastTwo,
    fullName,
    activitiesCount,
    dateSignedUp: user.created_at,
    argyleUserToken,
    argyleUserId,
    allArgyleAccountsAreConnected,
    argyleAccounts
  };
});
