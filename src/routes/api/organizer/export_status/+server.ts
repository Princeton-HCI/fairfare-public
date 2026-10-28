import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
  const {
    data: { user }
  } = await locals.supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const exportId = url.searchParams.get('id');
  if (!exportId) {
    return Response.json({ error: 'id parameter is required' }, { status: 400 });
  }

  let query = supabase
    .from('policy_analysis_exports')
    .select('id, status, total_rows, chunk_count, created_at, completed_at, error_message')
    .eq('user_id', user.id);

  // "latest" returns the most recent pending/processing export (for page-load resume)
  if (exportId === 'latest') {
    query = query.in('status', ['pending', 'processing']).order('created_at', { ascending: false });
  } else {
    query = query.eq('id', exportId);
  }

  const { data: exportRecord, error } = await query.limit(1).single();

  if (error || !exportRecord) {
    return Response.json({ error: 'Export not found' }, { status: 404 });
  }

  return Response.json({
    id: exportRecord.id,
    status: exportRecord.status,
    totalRows: exportRecord.total_rows,
    chunkCount: exportRecord.chunk_count,
    createdAt: exportRecord.created_at,
    completedAt: exportRecord.completed_at,
    errorMessage: exportRecord.error_message
  });
};
