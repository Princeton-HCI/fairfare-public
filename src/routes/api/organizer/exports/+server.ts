import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
  const {
    data: { user }
  } = await locals.supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('policy_analysis_exports')
    .select('id, status, total_rows, filters, created_at, completed_at, error_message, read_at')
    .eq('user_id', user.id)
    .gt('created_at', twoWeeksAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch exports:', error);
    return Response.json({ error: 'Failed to fetch exports' }, { status: 500 });
  }

  return Response.json({ exports: data ?? [] });
};
