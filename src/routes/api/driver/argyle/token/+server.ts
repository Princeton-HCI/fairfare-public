import { error, json, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { getUserToken } from '@src/lib/server/argyle';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';
import { resolveArgyleCredentials } from '@src/lib/server/organizationArgyle';

export const POST = async ({ locals: { safeGetSession } }: RequestEvent) => {
  try {
    const { user } = await safeGetSession();
    if (!user) throw new Error('No user id provided');

    const profile = await getProfileFromUserId(supabase, user.id);
    if (!profile.argyle_user) throw new Error('No Argyle user id found for user ' + user.id);

    const credentials = await resolveArgyleCredentials({ by: 'user', userId: user.id });
    const token = await getUserToken(profile.argyle_user, credentials);

    return json({ token });
  } catch (e) {
    console.error('error:', e);
    const message = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error';
    throw error(400, { message: 'Error getting user token from Argyle: ' + message });
  }
};
