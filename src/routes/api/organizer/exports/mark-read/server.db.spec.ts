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
import { PATCH } from './+server';

type HandlerEvent = Parameters<typeof PATCH>[0];

describe('PATCH /api/organizer/exports/mark-read', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUserByEmail(uniqueTestEmail('mark-read-test'));
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
      'http://localhost/api/organizer/exports/mark-read',
      { method: 'PATCH' }
    );
    const response = await PATCH(event as unknown as HandlerEvent);
    expect(response.status).toBe(401);
  });

  it('should mark unread completed/failed exports as read', async () => {
    const completed = await insertExportRecord({
      user_id: userId,
      status: 'completed',
      total_rows: 100
    });
    const failed = await insertExportRecord({
      user_id: userId,
      status: 'failed',
      error_message: 'err'
    });

    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/exports/mark-read',
      { method: 'PATCH', userId }
    );
    const response = await PATCH(event as unknown as HandlerEvent);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);

    const { data: rows } = await supabase
      .from('policy_analysis_exports')
      .select('id, read_at')
      .in('id', [completed.id, failed.id]);

    for (const row of rows!) {
      expect(row.read_at).not.toBeNull();
    }
  });

  it('should not modify already-read exports', async () => {
    const pastReadAt = '2025-01-01T00:00:00.000Z';
    await insertExportRecord({
      user_id: userId,
      status: 'completed',
      total_rows: 50,
      read_at: pastReadAt
    });

    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/exports/mark-read',
      { method: 'PATCH', userId }
    );
    await PATCH(event as unknown as HandlerEvent);

    const { data: rows } = await supabase
      .from('policy_analysis_exports')
      .select('read_at')
      .eq('user_id', userId);

    const storedReadAt = new Date(rows![0].read_at).toISOString();
    expect(storedReadAt).toBe(pastReadAt);
  });

  it('should not modify pending/processing exports', async () => {
    await insertExportRecord({ user_id: userId, status: 'processing', total_rows: 10 });

    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/exports/mark-read',
      { method: 'PATCH', userId }
    );
    await PATCH(event as unknown as HandlerEvent);

    const { data: rows } = await supabase
      .from('policy_analysis_exports')
      .select('read_at')
      .eq('user_id', userId);

    expect(rows![0].read_at).toBeNull();
  });
});
