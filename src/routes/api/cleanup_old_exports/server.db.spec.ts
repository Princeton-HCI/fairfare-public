import { POST } from './+server';
import { randomUUID } from 'crypto';
import { scopeDatabaseReads } from '@tests/utils/scopeDatabaseReads';
import { createInternalRequestEvent, createRequestEvent } from '@tests/utils/requestEvent';

type HandlerEvent = Parameters<typeof POST>[0];

describe('POST /api/cleanup_old_exports', () => {
  beforeEach(() => {
    // This worker must not delete expired exports belonging to another spec.
    scopeDatabaseReads('policy_analysis_exports', 'user_id', randomUUID());
  });
  describe('authentication', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const mockRequestEvent = createRequestEvent('http://localhost/api/cleanup_old_exports', {
        method: 'POST'
      }) as unknown as HandlerEvent;

      await expect(POST(mockRequestEvent)).rejects.toMatchObject({
        status: 401
      });
    });

    it('should return 401 when Authorization header is invalid', async () => {
      const mockRequestEvent = createRequestEvent('http://localhost/api/cleanup_old_exports', {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid-secret' }
      }) as unknown as HandlerEvent;

      await expect(POST(mockRequestEvent)).rejects.toMatchObject({
        status: 401
      });
    });
  });

  it('should return {deleted: 0} when no expired exports exist', async () => {
    const response = await POST(
      createInternalRequestEvent('http://localhost/api/cleanup_old_exports', {
        method: 'POST'
      }) as unknown as HandlerEvent
    );
    const data = await response.json();
    expect(data).toEqual({ deleted: 0 });
  });
});
