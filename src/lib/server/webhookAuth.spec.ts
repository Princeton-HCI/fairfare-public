import { createHmac } from 'crypto';
import { describe, it, expect } from 'vitest';
import { verifyArgyleWebhookSignature, WebhookSignatureError } from './webhookAuth';

// Use the secret from env (with fallback for CI where env var may not be set)
const testSecret = process.env.ARGYLE_WEBHOOK_SECRET || 'test-webhook-secret';

describe('verifyArgyleWebhookSignature', () => {
  const generateValidSignature = (body: string, secret: string = testSecret): string => {
    return createHmac('sha512', secret).update(body).digest('hex');
  };

  describe('with valid signature', () => {
    it('returns true for a valid signature', () => {
      const body = JSON.stringify({
        event: 'accounts.added',
        name: 'test-webhook',
        data: { account: '123', user: '456' }
      });
      const signature = generateValidSignature(body);

      expect(verifyArgyleWebhookSignature(body, signature)).toBe(true);
    });

    it('verifies signature for empty object body', () => {
      const body = '{}';
      const signature = generateValidSignature(body);

      expect(verifyArgyleWebhookSignature(body, signature)).toBe(true);
    });

    it('verifies signature with special characters in body', () => {
      const body = JSON.stringify({
        event: 'test',
        data: { message: 'Hello "world" & <friends>' }
      });
      const signature = generateValidSignature(body);

      expect(verifyArgyleWebhookSignature(body, signature)).toBe(true);
    });

    it('verifies signature with unicode characters', () => {
      const body = JSON.stringify({
        event: 'test',
        data: { name: '日本語テスト 🚗' }
      });
      const signature = generateValidSignature(body);

      expect(verifyArgyleWebhookSignature(body, signature)).toBe(true);
    });
  });

  describe('with invalid signature', () => {
    it('throws WebhookSignatureError for mismatched signature', () => {
      const body = JSON.stringify({ event: 'test' });
      const wrongSignature = generateValidSignature('different body');

      expect(() => verifyArgyleWebhookSignature(body, wrongSignature)).toThrow(
        WebhookSignatureError
      );
      expect(() => verifyArgyleWebhookSignature(body, wrongSignature)).toThrow(
        'Invalid webhook signature'
      );
    });

    it('throws WebhookSignatureError for tampered body', () => {
      const originalBody = JSON.stringify({ event: 'test', data: { amount: 100 } });
      const signature = generateValidSignature(originalBody);
      const tamperedBody = JSON.stringify({ event: 'test', data: { amount: 999 } });

      expect(() => verifyArgyleWebhookSignature(tamperedBody, signature)).toThrow(
        WebhookSignatureError
      );
    });

    it('throws WebhookSignatureError for signature with wrong length', () => {
      const body = JSON.stringify({ event: 'test' });
      const shortSignature = 'abc123';

      expect(() => verifyArgyleWebhookSignature(body, shortSignature)).toThrow(
        WebhookSignatureError
      );
    });

    it('throws WebhookSignatureError for non-hex signature', () => {
      const body = JSON.stringify({ event: 'test' });
      // 128 characters but not valid hex
      const invalidHexSignature = 'g'.repeat(128);

      expect(() => verifyArgyleWebhookSignature(body, invalidHexSignature)).toThrow();
    });
  });

  describe('with missing signature', () => {
    it('throws WebhookSignatureError when signature is null', () => {
      const body = JSON.stringify({ event: 'test' });

      expect(() => verifyArgyleWebhookSignature(body, null)).toThrow(WebhookSignatureError);
      expect(() => verifyArgyleWebhookSignature(body, null)).toThrow(
        'Missing X-Argyle-Signature header'
      );
    });

    it('throws WebhookSignatureError when signature is empty string', () => {
      const body = JSON.stringify({ event: 'test' });

      expect(() => verifyArgyleWebhookSignature(body, '')).toThrow(WebhookSignatureError);
      expect(() => verifyArgyleWebhookSignature(body, '')).toThrow(
        'Missing X-Argyle-Signature header'
      );
    });
  });

  // Note: Testing for missing ARGYLE_WEBHOOK_SECRET requires module re-isolation
  // which is complex with vi.mock. The check exists in the implementation and will
  // throw at runtime if the secret is not configured.
});

describe('WebhookSignatureError', () => {
  it('has correct name property', () => {
    const error = new WebhookSignatureError('test message');
    expect(error.name).toBe('WebhookSignatureError');
  });

  it('is instance of Error', () => {
    const error = new WebhookSignatureError('test message');
    expect(error).toBeInstanceOf(Error);
  });

  it('preserves message', () => {
    const error = new WebhookSignatureError('custom error message');
    expect(error.message).toBe('custom error message');
  });
});
