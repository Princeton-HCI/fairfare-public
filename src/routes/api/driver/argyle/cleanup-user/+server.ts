import { json, type RequestEvent } from '@sveltejs/kit';
import { getGlobalArgyleCredentials } from '@src/lib/server/argyle';
import { deleteArgyleUser } from '@src/lib/server/argyleAdmin';
import { resolveArgyleCredentials } from '@src/lib/server/organizationArgyle';
import { supabase } from '@src/lib/server/db';

export const POST = async ({ locals }: RequestEvent) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('argyle_user')
    .eq('user_id', user.id)
    .single();

  if (!profile?.argyle_user) {
    return json({ success: true });
  }

  const { count } = await supabase
    .from('argyle_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('deleted_at', null);

  if (count && count > 0) {
    return json({ success: true });
  }

  const credentials = await resolveArgyleCredentials({ by: 'user', userId: user.id });
  const adminCreds = credentials
    ? {
        apiKeyId: credentials.apiKeyId,
        apiKeySecret: credentials.apiKeySecret,
        linkUrl: credentials.linkUrl
      }
    : getGlobalArgyleCredentials();

  try {
    await deleteArgyleUser(adminCreds, profile.argyle_user);
  } catch (error) {
    console.error('Failed to delete orphaned Argyle user:', error);
  }

  await supabase.from('profiles').update({ argyle_user: null }).eq('user_id', user.id);

  return json({ success: true });
};
