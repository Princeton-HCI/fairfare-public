import { error, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { getUserToken } from '@src/lib/server/argyle';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';

export const POST = async (request: RequestEvent) => {
  try {
    const { user } = await request.locals.safeGetSession();
    if (!user) throw new Error('No user id provided');

    const profile = await getProfileFromUserId(supabase, user.id);
    if (!profile.argyle_user) throw new Error('No Argyle user id found for user ' + user.id);
    const token = await getUserToken(profile.argyle_user);

    console.log('refreshed token for user', user.id);
    return new Response(JSON.stringify({ token }));
  } catch (e) {
    console.error('error:', e);
    if (e instanceof Error) {
      throw error(400, { message: 'Error getting user token from Argyle: ' + e.message });
    } else {
      throw error(400, { message: 'Error getting user token from Argyle: ' + e });
    }
  }
};
