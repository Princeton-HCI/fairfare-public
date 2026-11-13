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

vi.mock('@src/lib/server/exportStorage', () => ({
  downloadFinalFile: vi.fn().mockResolvedValue('column\nvalue\n')
}));

type HandlerEvent = Parameters<typeof GET>[0];

describe('GET /api/organizer/download_export', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUserByEmail(uniqueTestEmail('download-export-test'));
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
      'http://localhost/api/organizer/download_export?id=some-id'
    );
    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(401);
  });

  it('should return 400 when id param is missing', async () => {
    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/download_export',
      { userId }
    );
    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(400);
  });

  it('should return 404 when export does not exist', async () => {
    const event = createAuthenticatedRequestEvent(
      'http://localhost/api/organizer/download_export?id=00000000-0000-0000-0000-000000000000',
      { userId }
    );
    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(404);
  });

  it('should return 400 when export is not completed', async () => {
    const record = await insertExportRecord({
      user_id: userId,
      status: 'processing',
      total_rows: 50
    });

    const event = createAuthenticatedRequestEvent(
      `http://localhost/api/organizer/download_export?id=${record.id}`,
      { userId }
    );
    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(400);
  });

  it('returns 403 when organization export access was revoked after creation', async () => {
    const record = await insertExportRecord({
      user_id: userId,
      organization_key: 'du',
      status: 'completed',
      file_path: `${userId}/revoked.csv`
    });

    const event = createAuthenticatedRequestEvent(
      `http://localhost/api/organizer/download_export?id=${record.id}`,
      {
        userId,
        roles: { userId, platformRole: 'organizer', orgRoles: {} }
      }
    );

    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(403);
  });

  it('returns 403 when a researcher tries to download a cross-org export', async () => {
    const record = await insertExportRecord({
      user_id: userId,
      organization_key: 'all',
      status: 'completed',
      file_path: `${userId}/all.csv`
    });

    const event = createAuthenticatedRequestEvent(
      `http://localhost/api/organizer/download_export?id=${record.id}`,
      {
        userId,
        roles: { userId, platformRole: 'researcher', orgRoles: {} }
      }
    );

    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(403);
  });

  it('allows a current organization exporter to download their completed export', async () => {
    const record = await insertExportRecord({
      user_id: userId,
      organization_key: 'du',
      status: 'completed',
      file_path: `${userId}/authorized.csv`
    });

    const event = createAuthenticatedRequestEvent(
      `http://localhost/api/organizer/download_export?id=${record.id}`,
      {
        userId,
        roles: { userId, platformRole: 'organizer', orgRoles: { du: 'organizer' } }
      }
    );

    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('column\nvalue\n');
  });

  it('allows an admin to download their completed cross-org export', async () => {
    const record = await insertExportRecord({
      user_id: userId,
      organization_key: 'all',
      status: 'completed',
      file_path: `${userId}/all.csv`
    });

    const event = createAuthenticatedRequestEvent(
      `http://localhost/api/organizer/download_export?id=${record.id}`,
      {
        userId,
        roles: { userId, platformRole: 'admin', orgRoles: {} }
      }
    );

    const response = await GET(event as unknown as HandlerEvent);
    expect(response.status).toBe(200);
  });
});
