import { describe, expect, it } from 'vitest';
import { encrypt, decrypt } from './encryption';

describe('encryption', () => {
  const aad = '11111111-1111-1111-1111-111111111111';

  it('round-trips a value with matching AAD', () => {
    const ciphertext = encrypt('hello world', aad);
    expect(decrypt(ciphertext, aad)).toBe('hello world');
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const a = encrypt('same', aad);
    const b = encrypt('same', aad);
    expect(a).not.toBe(b);
  });

  it('rejects decryption with a different AAD', () => {
    const ciphertext = encrypt('secret', aad);
    expect(() => decrypt(ciphertext, '99999999-9999-9999-9999-999999999999')).toThrow();
  });

  it('rejects an empty AAD on encrypt', () => {
    expect(() => encrypt('x', '')).toThrow(/AAD/);
  });

  it('rejects an empty AAD on decrypt', () => {
    const ciphertext = encrypt('x', aad);
    expect(() => decrypt(ciphertext, '')).toThrow(/AAD/);
  });

  it('rejects malformed ciphertext', () => {
    expect(() => decrypt('not-a-real-ciphertext', aad)).toThrow();
  });
});
