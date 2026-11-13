import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';
import { downloadFinalFile } from '@src/lib/server/exportStorage';
import { buildFilterFilename } from '@src/lib/server/csvStreamUtils';
import { canAccessAnalysisScope } from '@src/routes/organizer/utils.server';

export const GET: RequestHandler = async ({ url, locals }) => {
  const { user, roles } = await locals.safeGetSession();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const exportId = url.searchParams.get('id');
  if (!exportId) {
    return new Response('id parameter is required', { status: 400 });
  }

  const { data: exportRecord, error } = await supabase
    .from('policy_analysis_exports')
    .select('id, status, user_id, organization_key, file_path, filters')
    .eq('id', exportId)
    .eq('user_id', user.id)
    .single();

  if (error || !exportRecord) {
    return new Response('Export not found', { status: 404 });
  }

  // Export ownership is not enough: organization membership and platform roles
  // can be revoked after the file was generated. Re-check the capability at
  // download time so a stale URL cannot bypass the current RBAC state.
  if (!canAccessAnalysisScope(roles, exportRecord.organization_key, 'export')) {
    return new Response('Forbidden', { status: 403 });
  }

  if (exportRecord.status !== 'completed' || !exportRecord.file_path) {
    return new Response('Export is not ready for download', { status: 400 });
  }

  const csvData = await downloadFinalFile(exportId);

  const filters = (exportRecord.filters ?? {}) as Record<string, unknown>;
  const filterStr = buildFilterFilename({
    startDate: filters.startDate as string | null,
    endDate: filters.endDate as string | null,
    startLocation: filters.startLocation as string | null,
    endLocation: filters.endLocation as string | null,
    locationCombiner: filters.locationCombiner as string | null,
    platforms: filters.platforms as string[] | null
  });

  return new Response(csvData, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="policy_analysis_${filterStr}.csv"`
    }
  });
};
