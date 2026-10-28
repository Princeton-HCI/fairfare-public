import { json, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { isDemoMode } from '@src/lib/utils';

/**
 * Handle Argyle account disconnection in demo mode.
 * In production, the accounts.removed webhook handles this.
 * In demo mode, webhooks don't fire, so we soft-delete the account here
 * when the onAccountRemoved callback fires from Argyle Link.
 */
export const POST = async ({ locals, request }: RequestEvent) => {
  if (!isDemoMode) {
    return json({ error: 'This endpoint is only available in demo mode' }, { status: 403 });
  }

  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accountId } = await request.json();
  if (!accountId) {
    return json({ error: 'accountId is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('argyle_accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('argyle_account', accountId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error soft-deleting argyle account:', error);
    return json({ error: 'Failed to disconnect account' }, { status: 500 });
  }

  return json({ success: true });
};
