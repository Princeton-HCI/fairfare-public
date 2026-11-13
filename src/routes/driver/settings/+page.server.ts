import short from 'short-uuid';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from '../../$types';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';
import { supabase } from '@src/lib/server/db';
import { wrapLoadWithSentry } from '@sentry/sveltekit';
import { getUserToken, fetchAccountsByUser } from '@src/lib/server/argyle';
import { resolveArgyleCredentials } from '@src/lib/server/organizationArgyle';
import { isDemoMode } from '@src/lib/utils';
import { loadDemoArgyleActivities } from '@src/lib/server/demoData';
import type { ArgyleAccountResponse } from '$lib/types';

const buildDemoArgyleAccount = (
  argyleUserId: string,
  activitiesCount: number,
  accountDbId?: string
): ArgyleAccountResponse => {
  const now = new Date().toISOString();
  return {
    id: accountDbId ?? 'demo-account',
    user: argyleUserId,
    employers: ['Uber Driver'],
    item: 'uber',
    source: 'demo',
    created_at: now,
    updated_at: now,
    scanned_at: now,
    connection: {
      status: 'connected',
      error_code: null,
      error_message: null,
      updated_at: now
    },
    direct_deposit_switch: {
      status: 'idle',
      error_code: null,
      error_message: null,
      updated_at: now
    },
    availability: {
      gigs: {
        status: 'synced',
        updated_at: now,
        available_count: activitiesCount,
        available_from: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
        available_to: now
      },
      shifts: {
        status: 'synced',
        updated_at: now,
        available_count: 0,
        available_from: null,
        available_to: null
      },
      paystubs: {
        status: 'synced',
        updated_at: now,
        available_count: 0,
        available_from: now,
        available_to: now
      },
      payroll_documents: { status: 'synced', updated_at: now },
      identities: { status: 'synced', updated_at: now },
      ratings: { status: 'synced', updated_at: now },
      vehicles: { status: 'synced', updated_at: now },
      deposit_destinations: { status: 'synced', updated_at: now },
      user_forms: null,
      user_uploads: null
    },
    ongoing_refresh: { status: 'idle' }
  };
};

export const load: LayoutServerLoad = wrapLoadWithSentry(async ({ locals: { safeGetSession } }) => {
  const { user } = await safeGetSession();

  if (!user) {
    return redirect(303, '/driver/login');
  }

  const profile = await getProfileFromUserId(supabase, user.id);

  const argyleUserId = profile.argyle_user;

  // In demo mode, the phone is stored in the email (e.g. "15551234567@demo.system.local")
  if (!profile.phone && isDemoMode && user.email) {
    profile.phone = user.email.split('@')[0];
  }

  if (!profile.phone) {
    throw new Error('No phone found for this user');
  }

  // argyle_user may be null if the driver hasn't completed an Argyle Link
  // flow yet (bootstrap creates it lazily in the right tenant). Tolerate
  // missing values — the settings page renders the "no accounts" state.
  const phoneNumberLastTwo = profile.phone.slice(-2);

  const fullName =
    profile.first_name && profile.last_initial
      ? `${profile.first_name} ${profile.last_initial}`
      : isDemoMode
        ? 'Demo Driver'
        : '(Missing Name)';

  // get the count of `argyle_driver_activities`
  const { error: activitiesError, count: dbActivitiesCount } = await supabase
    .from('argyle_driver_activities')
    .select('*', { count: 'exact', head: true })
    .eq('user', user.id);

  if (activitiesError) {
    console.error('Error getting activities count', activitiesError);
    return {};
  }

  let activitiesCount = dbActivitiesCount ?? 0;

  // If no Argyle user exists yet, return the basic "no accounts" view —
  // the driver can still link via the settings page button.
  if (!argyleUserId) {
    return {
      userId: user.id,
      shortUserId: short().fromUUID(user.id),
      phoneNumber: profile.phone,
      phoneNumberLastTwo,
      fullName,
      activitiesCount,
      dateSignedUp: user.created_at,
      argyleUserToken: '',
      argyleUserId,
      allArgyleAccountsAreConnected: true,
      argyleAccounts: [] as ArgyleAccountResponse[],
      hasAnyArgyleAccounts: false
    };
  }

  // In demo mode: ensure demo activities exist and skip Argyle API calls entirely.
  if (isDemoMode) {
    // If no activities yet, insert them now (handles users who connected before this change)
    // Fetch the argyle account row for both activity generation and the mock account card
    const { data: argyleAccount } = await supabase
      .from('argyle_accounts')
      .select('id, argyle_account')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (activitiesCount === 0 && argyleAccount) {
      // Race-condition note: concurrent page loads may both see count=0 and
      // attempt inserts. The ride_hash unique constraint prevents true duplicates;
      // we catch and ignore constraint violations here.
      try {
        const demoActivities = loadDemoArgyleActivities(
          user.id,
          argyleAccount.argyle_account,
          argyleAccount.id
        );
        const { error: insertError } = await supabase
          .from('argyle_driver_activities')
          .insert(demoActivities);

        if (insertError) {
          // Ignore unique constraint violations from concurrent inserts
          if (!insertError.code?.startsWith('23')) {
            console.error('Error inserting demo activities on settings page:', insertError);
          }
        } else {
          activitiesCount = demoActivities.length;
        }
      } catch {
        // Swallow constraint errors from race conditions
      }
    }

    return {
      userId: user.id,
      shortUserId: short().fromUUID(user.id),
      phoneNumber: profile.phone,
      phoneNumberLastTwo,
      fullName,
      activitiesCount,
      dateSignedUp: user.created_at,
      argyleUserToken: '',
      argyleUserId,
      allArgyleAccountsAreConnected: true,
      argyleAccounts: argyleAccount
        ? [buildDemoArgyleAccount(argyleUserId, activitiesCount, argyleAccount.id)]
        : [],
      hasAnyArgyleAccounts: !!argyleAccount
    };
  }

  // Normal (non-demo) flow: call Argyle API for real account data, with
  // org-scoped credentials when the driver has a primary org.
  const credentials = await resolveArgyleCredentials({ by: 'user', userId: user.id });
  const argyleUserToken = await getUserToken(argyleUserId, credentials);

  // check if all of the user's argyle accounts are connected
  const argyleAccounts = await fetchAccountsByUser(argyleUserId, credentials);
  const statuses = argyleAccounts.map((account) => account.connection.status);

  // If the value of connection.status is error, and the error_message is either
  // auth_required or expired_credentials, an account disconnection has occurred.
  // see: https://docs.argyle.com/workflows/reconnecting-accounts
  const allArgyleAccountsAreConnected = statuses.every((status) => status === 'connected');

  return {
    userId: user.id,
    shortUserId: short().fromUUID(user.id),
    phoneNumber: profile.phone,
    phoneNumberLastTwo,
    fullName,
    activitiesCount,
    dateSignedUp: user.created_at,
    argyleUserToken,
    argyleUserId,
    allArgyleAccountsAreConnected,
    argyleAccounts,
    hasAnyArgyleAccounts: argyleAccounts.length > 0
  };
});
