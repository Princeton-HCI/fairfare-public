import type { RequestHandler } from './$types';
import { supabase } from '@src/lib/server/db';
import { validateInternalApiKey } from '@src/lib/server/internalAuth';
import {
  uploadChunk,
  concatenateChunksToFinalFile,
  deleteChunks,
  deleteExport
} from '@src/lib/server/exportStorage';
import {
  CSV_HEADERS,
  BATCH_SIZE,
  COL_START_DATETIME,
  COL_ID,
  parseCSVLine,
  countNewlines,
  stripLastColumn,
  fetchBatchCSV,
  buildSummaryCSV
} from '@src/lib/server/policyAnalysisCsv';
import { fetchPolicyAnalysisStats } from '@src/lib/server/policyAnalysisStats';

const TIME_BUDGET_MS = 20_000;

/**
 * Processes one chunk of work for the oldest pending/processing export.
 * Called in a loop by the Netlify Background Function (processExport-background).
 * Also called by the scheduled fallback function (processExports.mts).
 *
 * Returns {processed: false} if no work to do.
 * Returns {processed: true, status: 'processing'} if more work remains.
 * Returns {processed: true, status: 'completed'} when the export is finished.
 * Returns {processed: true, status: 'failed'} on error.
 */
export const POST: RequestHandler = async ({ request }) => {
  validateInternalApiKey(request);

  const { data: job, error: fetchError } = await supabase
    .from('policy_analysis_exports')
    .select('*')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !job) {
    return Response.json({ processed: false });
  }

  const exportId: string = job.id;
  const filters = job.filters as {
    startDate: string | null;
    endDate: string | null;
    startLocation: string | null;
    endLocation: string | null;
    locationCombiner: string | null;
    platforms: string[] | null;
    driverIds: string[] | null;
  };

  try {
    if (job.status === 'pending') {
      await supabase
        .from('policy_analysis_exports')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', exportId);
    }

    let cursorStartDatetime: string | null = job.cursor_start_datetime ?? null;
    let cursorId: string | null = job.cursor_id ?? null;
    let chunkCount: number = job.chunk_count ?? 0;
    let totalRows: number = job.total_rows ?? 0;
    let allFetched = false;
    const startTime = Date.now();

    while (Date.now() - startTime < TIME_BUDGET_MS && !allFetched) {
      const csvText = await fetchBatchCSV(
        filters.driverIds,
        filters.startDate,
        filters.endDate,
        filters.startLocation,
        filters.endLocation,
        filters.locationCombiner === 'AND',
        filters.platforms,
        cursorStartDatetime,
        cursorId
      );

      const headerEnd = csvText.indexOf('\n');
      if (headerEnd === -1 || headerEnd >= csvText.length - 1) {
        allFetched = true;
        break;
      }

      const data = csvText.substring(headerEnd + 1).trimEnd();
      if (data.length === 0) {
        allFetched = true;
        break;
      }

      const lastNewline = data.lastIndexOf('\n');
      const lastLine = lastNewline >= 0 ? data.substring(lastNewline + 1) : data;
      const fields = parseCSVLine(lastLine);
      const nextId = fields[COL_ID] || null;

      if (!nextId) {
        allFetched = true;
      } else {
        cursorStartDatetime = fields[COL_START_DATETIME] || null;
        cursorId = nextId;
      }

      const stripped = stripLastColumn(data);
      const rowCount = countNewlines(data) + 1;
      totalRows += rowCount;

      let chunkCsv: string;
      if (chunkCount === 0) {
        chunkCsv = CSV_HEADERS.join(',') + '\n' + stripped + '\n';
      } else {
        chunkCsv = stripped + '\n';
      }

      await uploadChunk(exportId, chunkCount, chunkCsv);
      chunkCount++;

      await supabase
        .from('policy_analysis_exports')
        .update({
          cursor_start_datetime: cursorStartDatetime,
          cursor_id: cursorId,
          chunk_count: chunkCount,
          total_rows: totalRows,
          updated_at: new Date().toISOString()
        })
        .eq('id', exportId);

      if (rowCount < BATCH_SIZE) {
        allFetched = true;
      }
    }

    if (allFetched) {
      const aggData = await fetchPolicyAnalysisStats(supabase, {
        startDate: filters.startDate,
        endDate: filters.endDate,
        startState: filters.startLocation,
        endState: filters.endLocation,
        matchAllStates: filters.locationCombiner === 'AND',
        employers: filters.platforms,
        driverIds: filters.driverIds
      });

      if (aggData) {
        const summaryChunk = buildSummaryCSV(aggData) + '\n';
        await uploadChunk(exportId, chunkCount, summaryChunk);
        chunkCount++;
      }

      const filePath = await concatenateChunksToFinalFile(exportId);
      await deleteChunks(exportId);

      await supabase
        .from('policy_analysis_exports')
        .update({
          status: 'completed',
          chunk_count: chunkCount,
          total_rows: totalRows,
          file_path: filePath,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', exportId);

      return Response.json({ processed: true, status: 'completed', totalRows });
    }

    // More rows remain -- the background function will call us again
    return Response.json({ processed: true, status: 'processing', totalRows });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Export ${exportId} failed:`, message);

    await supabase
      .from('policy_analysis_exports')
      .update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString()
      })
      .eq('id', exportId);

    try {
      await deleteExport(exportId);
    } catch (cleanupErr) {
      console.error(`Failed to clean up storage for export ${exportId}:`, cleanupErr);
    }

    return Response.json({ processed: true, status: 'failed', error: message }, { status: 500 });
  }
};
