import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';
import { validateInternalApiKey } from '@src/lib/server/internalAuth';
import { deleteExport } from '@src/lib/server/exportStorage';

const RETENTION_DAYS = 14;

export const POST: RequestHandler = async ({ request }) => {
  validateInternalApiKey(request);

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error: queryError } = await supabase
    .from('policy_analysis_exports')
    .select('id')
    .lt('created_at', cutoff);

  if (queryError) {
    console.error('Failed to query expired exports:', queryError.message);
    return Response.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    return Response.json({ deleted: 0 });
  }

  let deleted = 0;
  for (const row of expired) {
    try {
      await deleteExport(row.id);
    } catch (err) {
      console.error(`Failed to delete storage for export ${row.id}, skipping DB delete:`, err);
      continue;
    }

    const { error: delError } = await supabase
      .from('policy_analysis_exports')
      .delete()
      .eq('id', row.id);

    if (delError) {
      console.error(`Failed to delete DB record for export ${row.id}:`, delError.message);
    } else {
      deleted++;
    }
  }

  console.log(
    `Cleaned up ${deleted}/${expired.length} expired exports (older than ${RETENTION_DAYS} days)`
  );
  return Response.json({ deleted, total: expired.length });
};
