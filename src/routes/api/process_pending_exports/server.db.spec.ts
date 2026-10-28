// @vitest-environment node
import { randomUUID } from 'crypto';
import { http, HttpResponse } from 'msw';
import { PUB_VITE_SUPABASE_URL } from '$env/static/public';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import { deleteExport, downloadFinalFile } from '@src/lib/server/exportStorage';
import { server } from '@tests/setupTests';
import { scopeDatabaseReads } from '@tests/utils/scopeDatabaseReads';
import { createInternalRequestEvent, createRequestEvent } from '@tests/utils/requestEvent';
import { insertExportRecord, cleanupExports } from '@tests/utils/exportTestHelpers';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';

const ENDPOINT = 'http://localhost/api/process_pending_exports';

// This handler is typed against its own route, so the generic mock event needs a
// cast — the same pattern the other endpoint specs use.
type HandlerEvent = Parameters<typeof POST>[0];

const post = () =>
  POST(createInternalRequestEvent(ENDPOINT, { method: 'POST' }) as unknown as HandlerEvent);

describe('POST /api/process_pending_exports', () => {
  let userId: string;
  const exportIds: string[] = [];

  beforeEach(async () => {
    const user = await createTestUserByEmail(uniqueTestEmail('process-pending-exports'));
    userId = user.id;
    scopeDatabaseReads('policy_analysis_exports', 'user_id', userId);
  });

  afterEach(async () => {
    // Drop any per-test handler (the storage-failure stub below) before
    // cleaning up: Vitest runs this hook before setupTests' resetHandlers, so
    // teardown would otherwise talk to the stub instead of real storage.
    server.resetHandlers();
    try {
      for (const id of exportIds.splice(0)) await deleteExport(id);
    } finally {
      if (userId) {
        await cleanupExports(userId);
        await teardownTestUserByUserId(userId);
      }
    }
  });

  const insertJob = async () => {
    const job = await insertExportRecord({
      user_id: userId,
      status: 'pending',
      // An explicit, empty driver set keeps the RPC from reading other fixtures.
      filters: { driverIds: [randomUUID()], startDate: null, endDate: null }
    });
    exportIds.push(job.id);
    return job;
  };

  it('rejects missing and invalid authorization', async () => {
    const headerVariants: Record<string, string>[] = [
      {},
      { Authorization: 'Bearer invalid-secret' }
    ];
    for (const headers of headerVariants) {
      await expect(
        POST(createRequestEvent(ENDPOINT, { method: 'POST', headers }) as unknown as HandlerEvent)
      ).rejects.toMatchObject({ status: 401 });
    }
  });

  it('reports no work when this queue has no pending exports', async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: false });
  });

  it('completes the selected export and writes a downloadable CSV', async () => {
    const job = await insertJob();
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      processed: true,
      status: 'completed',
      totalRows: 0
    });

    const { data: stored, error } = await supabase
      .from('policy_analysis_exports')
      .select('*')
      .eq('id', job.id)
      .single();
    expect(error).toBeNull();
    expect(stored).toMatchObject({
      status: 'completed',
      total_rows: 0,
      file_path: `policy-analysis/${job.id}/export.csv`
    });
    expect(stored.completed_at).not.toBeNull();
    const csv = await downloadFinalFile(job.id);
    expect(csv).toContain('Total');
  });

  it('returns HTTP 500 and persists a failed job when storage fails', async () => {
    const job = await insertJob();
    server.use(
      http.post(`${PUB_VITE_SUPABASE_URL}/storage/v1/object/*`, () =>
        HttpResponse.json({ message: 'Storage unavailable' }, { status: 500 })
      )
    );
    const response = await post();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      processed: true,
      status: 'failed',
      error: expect.stringContaining('Storage unavailable')
    });
    const { data: stored, error } = await supabase
      .from('policy_analysis_exports')
      .select('status, error_message')
      .eq('id', job.id)
      .single();
    expect(error).toBeNull();
    expect(stored).toMatchObject({
      status: 'failed',
      error_message: expect.stringContaining('Storage unavailable')
    });
  });
});
