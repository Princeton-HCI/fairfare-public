import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';

export const PATCH: RequestHandler = async ({ locals }) => {
  const {
    data: { user }
  } = await locals.supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { error } = await supabase
    .from('policy_analysis_exports')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
    .in('status', ['completed', 'failed']);

  if (error) {
    console.error('Failed to mark exports as read:', error);
    return Response.json({ error: 'Failed to mark as read' }, { status: 500 });
  }

  return Response.json({ ok: true });
};
