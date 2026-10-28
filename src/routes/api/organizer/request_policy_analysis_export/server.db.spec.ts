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
import { POST } from './+server';

type HandlerEvent = Parameters<typeof POST>[0];

describe('POST /api/organizer/request_policy_analysis_export', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUserByEmail(uniqueTestEmail('request-export-test'));
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
      'http://localhost/api/organizer/request_policy_analysis_export',
      { method: 'POST', body: { selectedScope: 'all' } }
    );
    const response = await POST(event as unknown as HandlerEvent);
    expect(response.status).toBe(401);
  });

  it('should return 400 when selectedScope is missing', async () => {
    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/request_policy_analysis_export',
      { method: 'POST', body: {}, userId }
    );
    const response = await POST(event as unknown as HandlerEvent);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('selectedScope');
  });

  it('should return 409 when user already has a pending export', async () => {
    await insertExportRecord({ user_id: userId, status: 'pending' });

    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/request_policy_analysis_export',
      { method: 'POST', body: { selectedScope: 'all' }, userId }
    );
    const response = await POST(event as unknown as HandlerEvent);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('already in progress');
  });

  it('should return 202 with export id on success', async () => {
    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/request_policy_analysis_export',
      { method: 'POST', body: { selectedScope: 'all' }, userId }
    );
    const response = await POST(event as unknown as HandlerEvent);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.id).toBeDefined();
    expect(typeof data.id).toBe('string');
  });
});
