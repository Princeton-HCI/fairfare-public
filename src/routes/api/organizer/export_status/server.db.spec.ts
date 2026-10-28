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
import { GET } from './+server';

type HandlerEvent = Parameters<typeof GET>[0];

describe('GET /api/organizer/export_status', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUserByEmail(uniqueTestEmail('export-status-test'));
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
      'http://localhost/api/organizer/export_status?id=some-id'
    );
    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(401);
  });

  it('should return 400 when id param is missing', async () => {
    const event = createAuthenticatedRequestEvent('http://localhost/api/organizer/export_status', {
      userId
    });
    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(400);
  });

  it('should return 404 when export does not exist', async () => {
    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/export_status?id=00000000-0000-0000-0000-000000000000',
      { userId }
    );
    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(404);
  });

  it('should return correct status fields for a pending export', async () => {
    const record = await insertExportRecord({ user_id: userId, status: 'pending', total_rows: 0 });

    const event = createAuthenticatedRequestEvent(
      `http://localhost/api/organizer/export_status?id=${record.id}`,
      { userId }
    );
    const response = await GET(event as unknown as HandlerEvent);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(record.id);
    expect(data.status).toBe('pending');
    expect(data.totalRows).toBe(0);
  });

  it('should return the most recent active export when id=latest', async () => {
    await insertExportRecord({ user_id: userId, status: 'processing', total_rows: 500 });

    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/export_status?id=latest',
      { userId }
    );
    const response = await GET(event as unknown as HandlerEvent);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('processing');
    expect(data.totalRows).toBe(500);
  });
});
