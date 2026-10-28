import { createHmac } from 'crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use the secret from env (with fallback for CI where env var may not be set)
const TEST_WEBHOOK_SECRET = process.env.ARGYLE_WEBHOOK_SECRET || 'test-webhook-secret';

// Mock handleWebhook to avoid importing all webhook handler dependencies
vi.mock('./handleWebhook', () => ({
  handleWebhook: vi.fn()
}));

import { POST } from './+server';
import { handleWebhook } from './handleWebhook';

const mockedHandleWebhook = vi.mocked(handleWebhook);

const generateSignature = (body: string, secret: string = TEST_WEBHOOK_SECRET): string => {
  return createHmac('sha512', secret).update(body).digest('hex');
};

const createMockRequest = (body: string, signature: string | null): Request => {
  const headers = new Headers();
  if (signature !== null) {
    headers.set('X-Argyle-Signature', signature);
  }

  return {
    text: () => Promise.resolve(body),
    headers
  } as unknown as Request;
};

describe('POST /api/driver/argyle/webhooks', () => {
  beforeEach(() => {
    mockedHandleWebhook.mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('with valid signature', () => {
    it('returns 200 and processes the webhook', async () => {
      const payload = {
        event: 'accounts.added',
        name: 'test-webhook',
        data: { account: '123', user: '456' }
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(body);

      const request = createMockRequest(body, signature);
      // @ts-expect-error - partial mock for testing
      const response = await POST({ request });

      expect(response.status).toBe(200);
      expect(mockedHandleWebhook).toHaveBeenCalledTimes(1);
      expect(mockedHandleWebhook).toHaveBeenCalledWith(payload);
    });

    it('returns 200 for different webhook events', async () => {
      const payload = {
        event: 'gigs.partially_synced',
        name: 'gigs-webhook',
        data: {
          account: 'aaaaaaaa-bbbb-cccc-aaaa-aaaaaaaaaaaa',
          user: 'aaaaaaaa-bbbb-cccc-aaaa-000000000000',
          days_synced: 30
        }
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(body);

      const request = createMockRequest(body, signature);
      // @ts-expect-error - partial mock for testing
      const response = await POST({ request });

      expect(response.status).toBe(200);
      expect(mockedHandleWebhook).toHaveBeenCalledWith(payload);
    });
  });

  describe('with invalid signature', () => {
    it('returns 401 for mismatched signature', async () => {
      const body = JSON.stringify({ event: 'test' });
      const wrongSignature = generateSignature('different body');

      const request = createMockRequest(body, wrongSignature);
      // @ts-expect-error - partial mock for testing
      const response = await POST({ request });

      expect(response.status).toBe(401);
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Unauthorized');
      expect(mockedHandleWebhook).not.toHaveBeenCalled();
    });

    it('returns 401 for tampered body', async () => {
      const originalBody = JSON.stringify({ event: 'test', data: { amount: 100 } });
      const signature = generateSignature(originalBody);
      const tamperedBody = JSON.stringify({ event: 'test', data: { amount: 999 } });

      const request = createMockRequest(tamperedBody, signature);
      // @ts-expect-error - partial mock for testing
      const response = await POST({ request });

      expect(response.status).toBe(401);
      expect(mockedHandleWebhook).not.toHaveBeenCalled();
    });

    it('returns 401 for signature with wrong secret', async () => {
      const body = JSON.stringify({ event: 'test' });
      const wrongSecretSignature = generateSignature(body, 'wrong-secret');

      const request = createMockRequest(body, wrongSecretSignature);
      // @ts-expect-error - partial mock for testing
      const response = await POST({ request });

      expect(response.status).toBe(401);
      expect(mockedHandleWebhook).not.toHaveBeenCalled();
    });
  });

  describe('with missing signature', () => {
    it('returns 401 when X-Argyle-Signature header is missing', async () => {
      const body = JSON.stringify({ event: 'test' });

      const request = createMockRequest(body, null);
      // @ts-expect-error - partial mock for testing
      const response = await POST({ request });

      expect(response.status).toBe(401);
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Unauthorized');
      expect(mockedHandleWebhook).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns 500 when handleWebhook throws an error', async () => {
      mockedHandleWebhook.mockRejectedValue(new Error('Database error'));

      const body = JSON.stringify({ event: 'test' });
      const signature = generateSignature(body);

      const request = createMockRequest(body, signature);
      // @ts-expect-error - partial mock for testing
      const response = await POST({ request });

      expect(response.status).toBe(500);
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Database error');
    });

    it('returns 500 for non-Error exceptions', async () => {
      mockedHandleWebhook.mockRejectedValue('string error');

      const body = JSON.stringify({ event: 'test' });
      const signature = generateSignature(body);

      const request = createMockRequest(body, signature);
      // @ts-expect-error - partial mock for testing
      const response = await POST({ request });

      expect(response.status).toBe(500);
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Webhook error');
    });

    it('returns 500 for invalid JSON body after signature verification', async () => {
      const invalidJson = 'not valid json';
      const signature = generateSignature(invalidJson);

      const request = createMockRequest(invalidJson, signature);
      // @ts-expect-error - partial mock for testing
      const response = await POST({ request });

      expect(response.status).toBe(500);
      expect(mockedHandleWebhook).not.toHaveBeenCalled();
    });
  });
});
