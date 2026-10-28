import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import { insertExportRecord, cleanupExports } from '@tests/utils/exportTestHelpers';
import {
  createAuthenticatedRequestEvent,
  createUnauthenticatedRequestEvent
} from '@tests/utils/requestEvent';
import { supabase } from '@src/lib/server/db';
import { POST } from './+server';

type HandlerEvent = Parameters<typeof POST>[0];

describe('POST /api/organizer/exports/cancel', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUserByEmail(uniqueTestEmail('cancel-export-test'));
    userId = user.id;
  });

  afterAll(async () => {
    await cleanupExports(userId);
    await teardownTestUserByUserId(userId);
  });

  afterEach(async () => {
    await cleanupExports(userId);
  });

  it('should return 401 when user is not authenticated', async () => {
    const event = createUnauthenticatedRequestEvent(
      'http://localhost/api/organizer/exports/cancel',
      { method: 'POST', body: { id: 'some-id' } }
    );
    const response = await POST(event as unknown as HandlerEvent);
    expect(response.status).toBe(401);
  });

  it('should return 400 when id is missing', async () => {
    const event = createAuthenticatedRequestEvent('http://localhost/api/organizer/exports/cancel', {
      method: 'POST',
      body: {},
      userId
    });
    const response = await POST(event as unknown as HandlerEvent);
    expect(response.status).toBe(400);
  });

  it('should return 404 when export is already completed', async () => {
    const record = await insertExportRecord({
      user_id: userId,
      status: 'completed',
      total_rows: 100,
      file_path: 'policy-analysis/test/export.csv'
    });

    const event = createAuthenticatedRequestEvent('http://localhost/api/organizer/exports/cancel', {
      method: 'POST',
      body: { id: record.id },
      userId
    });
    const response = await POST(event as unknown as HandlerEvent);
    expect(response.status).toBe(404);
  });

  it('should cancel a processing export', async () => {
    const record = await insertExportRecord({
      user_id: userId,
      status: 'processing',
      total_rows: 50
    });

    const event = createAuthenticatedRequestEvent('http://localhost/api/organizer/exports/cancel', {
      method: 'POST',
      body: { id: record.id },
      userId
    });
    const response = await POST(event as unknown as HandlerEvent);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);

    const { data: updated } = await supabase
      .from('policy_analysis_exports')
      .select('status, error_message')
      .eq('id', record.id)
      .single();

    expect(updated!.status).toBe('failed');
    expect(updated!.error_message).toBe('Cancelled by user');
  });
});
