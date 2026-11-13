import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateInternalApiKey } from './internalAuth';

const secrets = vi.hoisted(() => ({ INTERNAL_API_SECRET: 'test-secret' as string | undefined }));
vi.mock('$env/dynamic/private', () => ({ env: secrets }));
afterEach(() => {
  secrets.INTERNAL_API_SECRET = 'test-secret';
});

describe('internal API authentication', () => {
  it('accepts the configured secret', () => {
    expect(() =>
      validateInternalApiKey(
        new Request('http://localhost', { headers: { Authorization: 'Bearer test-secret' } })
      )
    ).not.toThrow();
  });
  it('rejects missing or incorrect credentials', () => {
    expect(() => validateInternalApiKey(new Request('http://localhost'))).toThrow();
    expect(() =>
      validateInternalApiKey(
        new Request('http://localhost', { headers: { Authorization: 'Bearer wrong' } })
      )
    ).toThrow();
  });
  it('fails closed when the secret is not configured', () => {
    secrets.INTERNAL_API_SECRET = undefined;
    expect(() =>
      validateInternalApiKey(
        new Request('http://localhost', { headers: { Authorization: 'Bearer undefined' } })
      )
    ).toThrow();
  });
});
