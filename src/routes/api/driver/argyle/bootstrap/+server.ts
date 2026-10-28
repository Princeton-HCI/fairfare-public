import { PUB_ARGYLE_LINK_URL } from '$env/static/public';
import { json, type RequestEvent } from '@sveltejs/kit';
import {
  argyleFetch,
  buildArgyleUrl,
  getGlobalArgyleCredentials,
  getUserToken
} from '@src/lib/server/argyle';
import {
  getOrganizationArgyleCapacity,
  resolveArgyleCredentials,
  type ResolvedArgyleCredentials
} from '@src/lib/server/organizationArgyle';
import { supabase } from '@src/lib/server/db';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import { handleApiError, HttpError } from '@src/lib/server/apiErrors';

export const GET = async ({ locals, url }: RequestEvent) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgKey = url.searchParams.get('orgKey');

  try {
    let credentials: ResolvedArgyleCredentials | null = null;
    if (orgKey) {
      credentials = await resolveArgyleCredentials({ by: 'orgKey', organizationKey: orgKey });
    } else {
      credentials = await resolveArgyleCredentials({ by: 'user', userId: user.id });
    }

    const isActive = credentials ? credentials.isActive : true;

    let canConnect = true;
    let currentCount: number | null = null;
    let maxCount: number | null = null;
    let reason: 'over_capacity' | 'inactive_config' | undefined;

    if (credentials) {
      if (!isActive) {
        canConnect = false;
        reason = 'inactive_config';
      } else {
        const capacity = await getOrganizationArgyleCapacity(credentials);
        currentCount = capacity.currentCount;
        maxCount = capacity.maxArgyleAccounts;
        if (maxCount !== null && currentCount !== null && currentCount >= maxCount) {
          canConnect = false;
          reason = 'over_capacity';
        }
      }
    }

    const argyleUserId = await ensureArgyleUserForUser(user.id, credentials);
    const token = canConnect ? await getUserToken(argyleUserId, credentials) : '';

    return json({
      canConnect,
      ...(reason ? { reason } : {}),
      currentCount,
      maxCount,
      token,
      config: {
        apiHost: credentials?.linkUrl ?? PUB_ARGYLE_LINK_URL,
        flowId: credentials?.flowId ?? null,
        organizationId: credentials?.organizationId ?? null,
        organizationKey: credentials?.organizationKey ?? null
      }
    });
  } catch (error) {
    return handleApiError(error, 'Failed to bootstrap Argyle link');
  }
};

const ensureArgyleUserForUser = async (
  userId: string,
  orgCredentials: ResolvedArgyleCredentials | null
): Promise<string> => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, argyle_user')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    throw new HttpError('Could not find profile for user ' + userId, 404);
  }

  if (profile.argyle_user) return profile.argyle_user;

  const creds = orgCredentials ?? getGlobalArgyleCredentials();
  const linkUrl = orgCredentials?.linkUrl ?? PUB_ARGYLE_LINK_URL;
  const url = buildArgyleUrl('/users', linkUrl);
  const response = await argyleFetch(
    url,
    { method: 'POST', headers: { 'content-type': 'application/json' } },
    { apiKeyId: creds.apiKeyId, apiKeySecret: creds.apiKeySecret }
  );

  const data = await response.json();
  if (!response.ok || !data.id) {
    console.error('Failed to create Argyle user:', data);
    throw new HttpError('Failed to create Argyle user', 502);
  }

  await updateProfileByUserId(supabase, userId, { argyle_user: data.id });
  return data.id as string;
};
