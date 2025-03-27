import { PUB_ARGYLE_LINK_URL } from '$env/static/public';
import { supabase } from '@lib/server/db';
import { flattenObj } from '@lib/utils';
import _ from 'lodash';
import type { ArgyleIdentity, ArgyleAccountResponse, ArgyleGigsResponse } from '$lib/types';
import { updateProfileByUserId } from '../databaseHelpers';
import { UserDoesNotExistError } from '../errors';

type DriverActivity = SupabaseRows['argyle_driver_activities'];
type Profile = SupabaseRows['profiles'];

export class ArgyleRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgyleRateLimitError';
  }
}

export const authString = btoa(
  `${import.meta.env.VITE_ARGYLE_API_KEY}:${import.meta.env.VITE_ARGYLE_API_SECRET}`
);

const ArgyleDriverActivitiesTemplate = {
  id: '',
  account: null,
  employer: null,
  created_at: null,
  updated_at: null,
  status: null,
  type: null,
  duration: null,
  timezone: null,
  earning_type: null,
  start_location_lat: null,
  start_location_lng: null,
  end_location_lat: null,
  end_location_lng: null,
  start_location_formatted_address: null,
  end_location_formatted_address: null,
  distance: null,
  distance_unit: null,
  metadata: null,
  circumstances_is_pool: null,
  circumstances_is_rush: null,
  circumstances_is_surge: null,
  circumstances_service_type: null,
  circumstances_position: null,
  income_currency: null,
  income_total_charge: null,
  income_fees: null,
  income_total: null,
  income_pay: null,
  income_tips: null,
  income_bonus: null,
  income_rates_hour: null,
  income_rates_mile: null,
  start_location: null,
  end_location: null,
  metadata_circumstances_is_pool: null,
  metadata_circumstances_is_rush: null,
  metadata_circumstances_is_surge: null,
  metadata_circumstances_service_type: null,
  metadata_origin_id: null,
  end_datetime: null,
  start_datetime: null,
  task_count: null,
  income_other: null,
  user: null
};

const validActivityKeys: string[] = Object.keys(ArgyleDriverActivitiesTemplate);

export const buildArgyleUrl = (path: string) => {
  return `${PUB_ARGYLE_LINK_URL}/v2${path}`;
};

export const argyleFetch = async (
  url: string,
  options: RequestInit | undefined,
  maxRetries = 5
): Promise<Response> => {
  const baseOptions = {
    ...options,
    headers: {
      ...options?.headers,
      accept: 'application/json',
      authorization: `Basic ${authString}`
    }
  };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await fetch(url, baseOptions);

    if (result.status !== 429) return result;
    console.log('Rate limited on attempt', attempt + 1);

    // Exponential backoff with jitter
    const backoffMs =
      Math.min(
        1000 * Math.pow(2, attempt),
        30000 // Max 30 seconds
      ) +
      Math.random() * 500;

    console.warn(`Rate limited on attempt ${attempt + 1}. Backing off for ${backoffMs}ms`);

    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }

  throw new ArgyleRateLimitError('Argyle rate limit exceeded after max retries');
};

/**
 * @param params - activity spec for argyle sync
 * @param params.account - Argyle account ID
 * @param params.from_start_date - ISO 8601 date string
 * @param params.to_start_date - ISO 8601 date string
 * @param params.limit - number of activities to return
 *
 * @returns {data, error}
 *
 * Returns a list of activities for the specified account.
 *
 *
 * @see https://developer.argyle.io/docs/api-reference#activities
 *
 */
// FIXME: rename to gigs to match Argyle docs
export const getActivities = async ({
  account,
  from_start_date,
  to_start_date,
  limit = 200
}: {
  account: string;
  from_start_date?: Date;
  to_start_date?: Date;
  limit?: number;
}) => {
  const params = new URLSearchParams({
    account
  });

  if (from_start_date) params.set('from_start_date', from_start_date.toISOString());
  if (to_start_date) params.set('to_start_date', to_start_date.toISOString());
  if (limit && limit != -1) params.set('limit', limit.toString());

  const allActivities = [];
  const firstPagePath = `/gigs?` + params.toString();

  let nextPageUrl = buildArgyleUrl(firstPagePath);
  while (nextPageUrl) {
    const res = await argyleFetch(nextPageUrl, { method: 'GET' }, 10);

    if (!res.ok) {
      // get response text
      const resText = await res.text();
      console.error(res.status, res.statusText, resText);
      throw new Error('Error fetching activities');
    }

    const { results, next } = await res.json();
    const flattenedActivities = flattenActivities(
      results as ArgyleGigsResponse[]
    ) as DriverActivity[];
    allActivities.push(...flattenedActivities);

    nextPageUrl = next; // Use the "next" URL for the next iteration
  }

  // Ensures that activities added to DB have only valid keys
  // Without this, any extra metadata keys from Argyle will cause an error.
  // TODO: implement `metadata` column in DB to store extra metadata
  const typedActivities = allActivities.map((activity) =>
    _.pick(activity, validActivityKeys)
  ) as DriverActivity[];
  return typedActivities;
};

export const getUserIdByAccount = async (argyle_account: string) => {
  const { data, error } = await supabase
    .from('argyle_accounts')
    .select('user_id')
    .eq('argyle_account', argyle_account)
    .single();
  if (data == null || error)
    throw new UserDoesNotExistError('Could not find argyle_account ' + argyle_account);
  return data.user_id;
};

export const getUserIdByArgyleUserId = async (argyle_user: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('argyle_user', argyle_user)
    .single();
  if (data == null || error)
    throw new Error(
      'Could not find user with argyle user id' + argyle_user + ': ' + error?.message
    );
  return data.user_id;
};

export const addAccountToActivities = async (activities: DriverActivity[], account: string) => {
  // get user with this account
  const userId = await getUserIdByAccount(account);
  // add user_id to each activity
  return activities.map((activity) => {
    return { ...activity, user: userId || null };
  });
};

/**
 *
 * Flatten an array of activities from argyle.
 * Argyle returns activities objects as nested objects. This flattens them into
 * a single level object that we can save to supabase.
 * @param activities {array} - array of activities from argyle
 * @returns {array} - array of flattened activities
 *
 */
const flattenActivities = (activities: ArgyleGigsResponse[]) => {
  return activities.map((activity) => {
    return flattenObj(activity, '');
  });
};

/**
 * Creates a new user token from the id of an existing user.
 * @param argyleUserId
 * @returns {string} - A new user token for the specified user
 * @see https://docs.argyle.com/api-reference/user-tokens
 */
export const getUserToken = async (argyleUserId: string): Promise<string> => {
  try {
    const url = buildArgyleUrl('/user-tokens');
    const res = await argyleFetch(url, {
      method: 'POST',
      body: new URLSearchParams({ user: argyleUserId })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Failed to get user token: ', data);
      throw new Error('Failed to get user token');
    }
    const { user_token } = data;
    return user_token;
  } catch (e) {
    console.log('Error getting user token: ', e);
    throw new Error('Could not get user token');
  }
};

export const fetchIdentity = async (identityId: string): Promise<ArgyleIdentity> => {
  const url = buildArgyleUrl(`/identities/${identityId}`);
  const response = await argyleFetch(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json'
      // Add any necessary authentication headers here
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch identity by ID: ${await response.text()}`);
  }

  return await response.json();
};

export const fetchAccount = async (accountId: string): Promise<ArgyleAccountResponse | null> => {
  const url = buildArgyleUrl(`/accounts/${accountId}`);
  const response = await argyleFetch(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json'
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch account by ID: ${await response.text()}`);
  }

  return await response.json();
};

export const fetchIdentityByAccount = async (account: string): Promise<ArgyleIdentity[]> => {
  const params = new URLSearchParams({
    account
  });
  const url = buildArgyleUrl('/identities?' + params);
  const response = await argyleFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to fetch identity by account: ${await response.text()}`);
  }

  const { results } = await response.json();
  return results;
};

export const fetchIdentityByUser = async (user: string): Promise<ArgyleIdentity[]> => {
  const params = new URLSearchParams({
    user
  });
  const url = buildArgyleUrl('/identities?' + params);
  const response = await argyleFetch(url, { method: 'GET' });

  if (!response.ok) {
    console.log('Identity fetch failed, response: ', response);
    throw new Error(`Failed to fetch identity by user ID ${user} : ${await response.text()}`);
  }

  const { results } = await response.json();
  return results;
};

export const addIdentityDataToUserAndEnableOtpLogin = async (
  argyleUserId: string,
  identityData: ArgyleIdentity
): Promise<Profile | undefined> => {
  const {
    account,
    first_name: firstName,
    last_name: lastName,
    email,
    phone_number: phoneNumber,
    address: { line1, line2, city, state, postal_code, country }
  } = identityData;

  const address = `${line1}, ${line2}, ${city}, ${state}, ${postal_code}, ${country}`;

  // strip the phone number of anything that's not a digit
  const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');

  const { data: findProfilesData, error: supabaseFindUserError } = await supabase
    .from('profiles')
    .select('*')
    .eq('argyle_user', argyleUserId);

  const userExists = findProfilesData !== null && !supabaseFindUserError;
  if (!userExists) throw new Error('Could not find user with argyle user or account ID');

  if (findProfilesData.length > 1) {
    throw new Error('Multiple users found with the same argyle user ID');
  }

  if (findProfilesData.length === 0) {
    throw new UserDoesNotExistError('No user found with argyle user ID: ' + argyleUserId);
  }

  const userId = findProfilesData[0].user_id!;

  const profile = await updateProfileByUserId(supabase, userId, {
    phone: cleanedPhoneNumber,
    first_name: firstName,
    last_name: lastName,
    address,
    argyle_user: argyleUserId,
    email
  });

  const { error: argyleAccountUpsertError } = await supabase
    .from('argyle_accounts')
    .upsert([{ argyle_account: account, user_id: userId, argyle_user: argyleUserId }], {
      onConflict: 'argyle_user, argyle_account',
      ignoreDuplicates: true
    });

  if (argyleAccountUpsertError) {
    throw new Error(
      'Could not add account to argyle_accounts: ' + argyleAccountUpsertError.message
    );
  }

  if (!profile) throw new Error('Could not update user profile');
  return profile;
};

// FIXME: remove me now that we have nightly data syncs
export const saveAllArgyleDriverActivitiesToDb = async (
  argyleIdentity: ArgyleIdentity,
  argyleAccount: string
) => {
  console.log('Updating all activities after signin...');
  const activities = await getActivities({
    account: argyleIdentity.account,
    limit: -1
  });

  // Use existing Argyle Account ID found on our user, NOT
  // the one returned from Argyle.
  const activitiesWithUser = (await addAccountToActivities(
    activities,
    argyleAccount
  )) as DriverActivity[];

  console.log('Saving ' + activities.length + ' activities to db...');
  // use upsert to avoid duplicate errors
  const { error: act_error } = await supabase
    .from('argyle_driver_activities')
    .upsert(activitiesWithUser);

  if (act_error) {
    if (
      act_error.message ===
      'duplicate key value violates unique constraint "argyle_driver_activities_pkey"'
    ) {
      console.log('Some duplicate keys');
    }
    console.log('Could not save activities to supabase: ', act_error);
  } else {
    console.log('saved ', +activities.length + ' records to db.');
  }
};

export const fetchAccountsByUser = async (
  argyleUserId: string
): Promise<ArgyleAccountResponse[]> => {
  const params = new URLSearchParams({
    user: argyleUserId
  });

  const url = buildArgyleUrl('/accounts?' + params.toString());
  const response = await argyleFetch(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch account by ID: ${await response.text()}`);
  }

  const data = await response.json();
  return data.results as ArgyleAccountResponse[];
};
