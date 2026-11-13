import { PUB_ARGYLE_LINK_URL } from '$env/static/public';
import { supabase } from '@lib/server/db';
import { flattenObj } from '@lib/utils';
import type {
  ArgyleIdentity,
  ArgyleAccountResponse,
  ArgyleGigsResponse,
  FlattenedArgyleGig
} from '$lib/types';
import { updateProfileByUserId } from '../databaseHelpers';
import { UserDoesNotExistError } from '../errors';
import { getLastInitialsFromLastName } from '@src/lib/nameUtils';
import { resolveArgyleCredentials, type ResolvedArgyleCredentials } from './organizationArgyle';

type Profile = SupabaseRows['profiles'];

export class ArgyleRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgyleRateLimitError';
  }
}

export const getGlobalArgyleCredentials = () => ({
  apiKeyId: import.meta.env.VITE_ARGYLE_API_KEY as string,
  apiKeySecret: import.meta.env.VITE_ARGYLE_API_SECRET as string,
  linkUrl: PUB_ARGYLE_LINK_URL,
  flowId: null as string | null
});

const buildAuthHeader = (apiKeyId: string, apiKeySecret: string) =>
  'Basic ' + btoa(`${apiKeyId}:${apiKeySecret}`);

export const buildArgyleUrl = (path: string, linkUrl = PUB_ARGYLE_LINK_URL) =>
  `${linkUrl}/v2${path}`;

type FetchCreds = Pick<ResolvedArgyleCredentials, 'apiKeyId' | 'apiKeySecret'> & {
  linkUrl?: string;
};

export const argyleFetch = async (
  url: string,
  options: RequestInit | undefined,
  credentials: FetchCreds | null = null,
  maxRetries = 5
): Promise<Response> => {
  const creds = credentials ?? getGlobalArgyleCredentials();
  const baseOptions = {
    ...options,
    headers: {
      ...options?.headers,
      accept: 'application/json',
      authorization: buildAuthHeader(creds.apiKeyId, creds.apiKeySecret)
    }
  };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await fetch(url, baseOptions);

    if (result.status !== 429) return result;

    const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000) + Math.random() * 500;
    console.warn(`Argyle rate limited (attempt ${attempt + 1}). Backing off ${backoffMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }

  throw new ArgyleRateLimitError('Argyle rate limit exceeded after max retries');
};

const resolveOrDefault = async (
  credentials: ResolvedArgyleCredentials | null | undefined,
  resolver: () => Promise<ResolvedArgyleCredentials | null>
): Promise<ResolvedArgyleCredentials | null> => {
  if (credentials !== undefined) return credentials;
  return resolver();
};

const linkUrlOf = (creds: ResolvedArgyleCredentials | null | undefined) =>
  creds?.linkUrl ?? PUB_ARGYLE_LINK_URL;

export const getFlattenedArgyleGigs = async ({
  account,
  from_start_date,
  to_start_date,
  limit = 200,
  credentials
}: {
  account: string;
  from_start_date?: Date;
  to_start_date?: Date;
  limit?: number;
  credentials?: ResolvedArgyleCredentials | null;
}): Promise<FlattenedArgyleGig[]> => {
  const resolved = await resolveOrDefault(credentials, () =>
    resolveArgyleCredentials({ by: 'account', argyleAccount: account })
  );

  const params = new URLSearchParams({ account });
  if (from_start_date) params.set('from_start_date', from_start_date.toISOString());
  if (to_start_date) params.set('to_start_date', to_start_date.toISOString());
  if (limit && limit !== -1) params.set('limit', limit.toString());

  const allFlattenedGigs: FlattenedArgyleGig[] = [];
  let nextPageUrl: string | null = buildArgyleUrl(
    `/gigs?` + params.toString(),
    linkUrlOf(resolved)
  );

  while (nextPageUrl) {
    const res = await argyleFetch(nextPageUrl, { method: 'GET' }, resolved, 10);

    if (!res.ok) {
      const resText = await res.text();
      console.error(res.status, res.statusText, resText);
      throw new Error('Error fetching activities');
    }

    const { results, next } = await res.json();
    allFlattenedGigs.push(...flattenArgyleGigs(results));
    nextPageUrl = next;
  }

  return allFlattenedGigs;
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

export const addAccountToActivities = async (
  activities: FlattenedArgyleGig[],
  account: string
): Promise<FlattenedArgyleGig[]> => {
  const userId = await getUserIdByAccount(account);
  return activities.map((activity) => ({ ...activity, user: userId || null }));
};

const flattenArgyleGigs = (activities: ArgyleGigsResponse[]): FlattenedArgyleGig[] => {
  return activities.map((activity) => {
    const flattened = flattenObj(activity, '') as FlattenedArgyleGig;
    return {
      user: '',
      id: flattened.id,
      account: flattened.account,
      employer: flattened.employer,
      created_at: flattened.created_at,
      updated_at: flattened.updated_at,
      status: flattened.status,
      type: flattened.type,
      task_count: Number(flattened.task_count),
      start_datetime: flattened.start_datetime,
      end_datetime: flattened.end_datetime,
      distance: flattened.distance,
      distance_unit: flattened.distance_unit,
      duration: Number(flattened.duration),
      timezone: flattened.timezone,
      earning_type: flattened.earning_type,
      start_location_lat: flattened.start_location_lat,
      start_location_lng: flattened.start_location_lng,
      start_location_formatted_address: flattened.start_location_formatted_address,
      end_location_lat: flattened.end_location_lat,
      end_location_lng: flattened.end_location_lng,
      end_location_formatted_address: flattened.end_location_formatted_address,
      circumstances_is_pool: Boolean(flattened.circumstances_is_pool),
      circumstances_is_rush: Boolean(flattened.circumstances_is_rush),
      circumstances_is_surge: Boolean(flattened.circumstances_is_surge),
      circumstances_service_type: flattened.circumstances_service_type,
      circumstances_position: flattened.circumstances_position,
      income_currency: flattened.income_currency,
      income_total_charge: flattened.income_total_charge,
      income_fees: flattened.income_fees,
      income_total: flattened.income_total,
      income_pay: flattened.income_pay,
      income_tips: flattened.income_tips,
      income_bonus: flattened.income_bonus,
      income_other: flattened.income_other,
      income_rates_hour: flattened.income_rates_hour,
      income_rates_mile: flattened.income_rates_mile,
      metadata_circumstances_is_rush: flattened.metadata_circumstances_is_rush,
      metadata_circumstances_is_pool: flattened.metadata_circumstances_is_pool,
      metadata_circumstances_is_surge: flattened.metadata_circumstances_is_surge,
      metadata_circumstances_service_type: flattened.metadata_circumstances_service_type,
      metadata_origin_id: flattened.metadata_origin_id
    };
  });
};

/**
 * Creates a new user token from the id of an existing user.
 * @see https://docs.argyle.com/api-reference/user-tokens
 */
export const getUserToken = async (
  argyleUserId: string,
  credentials?: ResolvedArgyleCredentials | null
): Promise<string> => {
  try {
    const resolved = await resolveOrDefault(credentials, () =>
      resolveArgyleCredentials({ by: 'argyleUser', argyleUser: argyleUserId })
    );

    const url = buildArgyleUrl('/user-tokens', linkUrlOf(resolved));
    const res = await argyleFetch(
      url,
      {
        method: 'POST',
        body: new URLSearchParams({ user: argyleUserId })
      },
      resolved
    );

    const data = await res.json();
    if (!res.ok) {
      console.error('Failed to get user token: ', data);
      throw new Error('Failed to get user token');
    }
    return data.user_token as string;
  } catch (e) {
    console.log('Error getting user token: ', e);
    throw new Error('Could not get user token');
  }
};

export const fetchIdentity = async (
  identityId: string,
  credentials?: ResolvedArgyleCredentials | null
): Promise<ArgyleIdentity> => {
  const url = buildArgyleUrl(`/identities/${identityId}`, linkUrlOf(credentials));
  const response = await argyleFetch(url, { method: 'GET' }, credentials ?? null);

  if (!response.ok) {
    throw new Error(`Failed to fetch identity by ID: ${await response.text()}`);
  }

  return await response.json();
};

export const fetchAccount = async (
  accountId: string,
  credentials?: ResolvedArgyleCredentials | null
): Promise<ArgyleAccountResponse | null> => {
  const resolved = await resolveOrDefault(credentials, () =>
    resolveArgyleCredentials({ by: 'account', argyleAccount: accountId })
  );

  const url = buildArgyleUrl(`/accounts/${accountId}`, linkUrlOf(resolved));
  const response = await argyleFetch(url, { method: 'GET' }, resolved);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch account by ID: ${await response.text()}`);
  }

  return await response.json();
};

export const fetchIdentityByAccount = async (
  account: string,
  credentials?: ResolvedArgyleCredentials | null
): Promise<ArgyleIdentity[]> => {
  const resolved = await resolveOrDefault(credentials, () =>
    resolveArgyleCredentials({ by: 'account', argyleAccount: account })
  );

  const params = new URLSearchParams({ account });
  const url = buildArgyleUrl('/identities?' + params, linkUrlOf(resolved));
  const response = await argyleFetch(url, { method: 'GET' }, resolved);

  if (!response.ok) {
    throw new Error(`Failed to fetch identity by account: ${await response.text()}`);
  }

  const { results } = await response.json();
  return results;
};

export const fetchIdentityByUser = async (
  user: string,
  credentials?: ResolvedArgyleCredentials | null
): Promise<ArgyleIdentity[]> => {
  const resolved = await resolveOrDefault(credentials, () =>
    resolveArgyleCredentials({ by: 'argyleUser', argyleUser: user })
  );

  const params = new URLSearchParams({ user });
  const url = buildArgyleUrl('/identities?' + params, linkUrlOf(resolved));
  const response = await argyleFetch(url, { method: 'GET' }, resolved);

  if (!response.ok) {
    console.log('Identity fetch failed, response: ', response);
    throw new Error(`Failed to fetch identity by user ID ${user} : ${await response.text()}`);
  }

  const { results } = await response.json();
  return results;
};

/**
 * Add identity data to a user and enable OTP login.
 *
 * Note: does **not** update the user's phone number since they input it when
 * they sign up on the frontend.
 */
export const addIdentityDataToUserAndEnableOtpLogin = async (
  argyleUserId: string,
  identityData: ArgyleIdentity,
  options?: { organizationId?: string | null }
): Promise<Profile | undefined> => {
  const {
    account,
    first_name: firstName,
    last_name: lastName,
    address: { postal_code }
  } = identityData;

  const lastInitial = getLastInitialsFromLastName(lastName);
  const address = `${postal_code}`;

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
    first_name: firstName,
    last_initial: lastInitial,
    address,
    argyle_user: argyleUserId
  });

  let organizationId: string | null = options?.organizationId ?? null;
  if (organizationId === null) {
    const { data: existing } = await supabase
      .from('argyle_accounts')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('argyle_user', argyleUserId)
      .eq('argyle_account', account)
      .maybeSingle();
    organizationId = existing?.organization_id ?? null;
  }

  const { error: argyleAccountUpsertError } = await supabase.from('argyle_accounts').upsert(
    [
      {
        argyle_account: account,
        user_id: userId,
        argyle_user: argyleUserId,
        organization_id: organizationId
      }
    ],
    {
      onConflict: 'argyle_user,argyle_account,user_id',
      ignoreDuplicates: true
    }
  );

  if (argyleAccountUpsertError) {
    throw new Error(
      'Could not add account to argyle_accounts: ' + argyleAccountUpsertError.message
    );
  }

  if (!profile) throw new Error('Could not update user profile');
  return profile;
};

export const fetchAccountsByUser = async (
  argyleUserId: string,
  credentials?: ResolvedArgyleCredentials | null
): Promise<ArgyleAccountResponse[]> => {
  const resolved = await resolveOrDefault(credentials, () =>
    resolveArgyleCredentials({ by: 'argyleUser', argyleUser: argyleUserId })
  );

  const params = new URLSearchParams({ user: argyleUserId });
  const url = buildArgyleUrl('/accounts?' + params.toString(), linkUrlOf(resolved));
  const response = await argyleFetch(url, { method: 'GET' }, resolved);

  if (!response.ok) {
    throw new Error(`Failed to fetch account by ID: ${await response.text()}`);
  }

  const data = await response.json();
  return data.results;
};

export const saveAllArgyleDriverActivitiesToDb = async (
  argyleIdentity: ArgyleIdentity,
  argyleAccount: string,
  credentials?: ResolvedArgyleCredentials | null
) => {
  console.log('Updating all activities after signin...');
  const activities = await getFlattenedArgyleGigs({
    account: argyleIdentity.account,
    limit: -1,
    credentials
  });
  const activitiesWithUser = await addAccountToActivities(activities, argyleAccount);

  const { error: act_error } = await supabase
    .from('argyle_driver_activities')
    .upsert(activitiesWithUser);

  if (act_error) {
    console.log('Could not save activities to supabase: ', act_error);
  } else {
    console.log('saved ', activities.length, ' records to db.');
  }
};
