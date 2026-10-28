import { json, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { isDemoMode } from '@src/lib/utils';
import { loadDemoArgyleActivities } from '@src/lib/server/demoData';
import {
  getOrganizationByKey,
  getPrimaryOrganizationForUser
} from '@src/lib/server/organizationArgyle';

export const POST = async ({ locals, request }: RequestEvent) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accountId, argyleUserId, orgKey } = await request.json();
  if (!accountId || !argyleUserId) {
    return json({ error: 'accountId and argyleUserId are required' }, { status: 400 });
  }

  // Demo unions (nstlte/plc/aass) have no organization_argyle_configs; use the
  // legacy global insert path so connect succeeds with sandbox credentials only.
  let organizationId: string | null = null;
  if (!isDemoMode) {
    if (typeof orgKey === 'string' && orgKey) {
      const org = await getOrganizationByKey(orgKey);
      if (!org) return json({ error: 'Organization not found' }, { status: 404 });
      organizationId = org.id;
    } else {
      const primary = await getPrimaryOrganizationForUser(user.id);
      organizationId = primary?.id ?? null;
    }
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'connect_argyle_account_with_capacity',
    {
      p_user_id: user.id,
      p_argyle_user: argyleUserId,
      p_argyle_account: accountId,
      p_organization_id: organizationId
    }
  );

  if (rpcError) {
    console.error('connect_argyle_account_with_capacity RPC error:', rpcError);
    return json({ error: 'Failed to save account' }, { status: 500 });
  }

  const result = rpcResult as {
    over_capacity?: boolean;
    reason?: string;
    current_count?: number;
    max_count?: number;
  } | null;

  if (result?.over_capacity) {
    if (result.reason === 'inactive_or_missing_config') {
      return json(
        { error: 'This organization is not accepting new connections.' },
        { status: 410 }
      );
    }
    return json(
      {
        error: 'This organization has reached its Argyle account limit.',
        currentCount: result.current_count ?? null,
        maxCount: result.max_count ?? null
      },
      { status: 409 }
    );
  }

  if (isDemoMode) {
    try {
      const { data: dbAccount } = await supabase
        .from('argyle_accounts')
        .select('id')
        .eq('argyle_account', accountId)
        .eq('user_id', user.id)
        .single();

      const accountDbId = dbAccount?.id ?? null;
      const demoActivities = loadDemoArgyleActivities(user.id, accountId, accountDbId);
      const { error: insertError } = await supabase
        .from('argyle_driver_activities')
        .upsert(demoActivities);

      if (insertError) {
        console.error('Error inserting demo activities:', insertError);
      }
    } catch (error) {
      console.error('Error generating demo data:', error);
    }
  }

  return json({ success: true });
};
