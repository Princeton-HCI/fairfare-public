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

describe('GET /api/organizer/exports', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUserByEmail(uniqueTestEmail('exports-list-test'));
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
    const event = createUnauthenticatedRequestEvent('http://localhost/api/organizer/exports');
    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(401);
  });

  it('should return empty array when user has no exports', async () => {
    const event = createAuthenticatedRequestEvent('http://localhost/api/organizer/exports', {
      userId
    });
    const response = await GET(event as unknown as HandlerEvent);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.exports).toEqual([]);
  });

  it('should return exports belonging to the user', async () => {
    await insertExportRecord({ user_id: userId, status: 'completed', total_rows: 100 });
    await insertExportRecord({ user_id: userId, status: 'failed', error_message: 'test error' });

    const event = createAuthenticatedRequestEvent('http://localhost/api/organizer/exports', {
      userId
    });
    const response = await GET(event as unknown as HandlerEvent);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.exports).toHaveLength(2);
  });

  it('should not return exports belonging to other users', async () => {
    const otherUser = await createTestUserByEmail(uniqueTestEmail('exports-list-other'));
    await insertExportRecord({ user_id: otherUser.id, status: 'completed', total_rows: 50 });

    const event = createAuthenticatedRequestEvent('http://localhost/api/organizer/exports', {
      userId
    });
    const response = await GET(event as unknown as HandlerEvent);
    const data = await response.json();

    expect(data.exports).toHaveLength(0);

    await cleanupExports(otherUser.id);
    await teardownTestUserByUserId(otherUser.id);
  });
});
