import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';
import { deleteExport } from '@src/lib/server/exportStorage';

export const POST: RequestHandler = async ({ request, locals }) => {
  const {
    data: { user }
  } = await locals.supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const exportId = body.id as string | undefined;

  if (!exportId) {
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('policy_analysis_exports')
    .update({
      status: 'failed',
      error_message: 'Cancelled by user',
      updated_at: new Date().toISOString()
    })
    .eq('id', exportId)
    .eq('user_id', user.id)
    .in('status', ['pending', 'processing'])
    .select('id')
    .single();

  if (error || !data) {
    return Response.json({ error: 'Export not found or already finished' }, { status: 404 });
  }

  try {
    await deleteExport(exportId);
  } catch (cleanupErr) {
    console.error(`Failed to clean up storage for cancelled export ${exportId}:`, cleanupErr);
  }

  return Response.json({ ok: true });
};
