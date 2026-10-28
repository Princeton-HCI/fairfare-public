import { env } from '$env/dynamic/private';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const getEncryptionKey = (): Buffer => {
  const key = env.ARGYLE_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ARGYLE_ENCRYPTION_KEY is not configured');
  }

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ARGYLE_ENCRYPTION_KEY must be a 64-character hex string');
  }

  return Buffer.from(key, 'hex');
};

export const encrypt = (plaintext: string, aad: string): string => {
  if (!aad) {
    throw new Error('encrypt() requires a non-empty AAD');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (encryptedValue: string, aad: string): string => {
  if (!aad) {
    throw new Error('decrypt() requires a non-empty AAD');
  }

  const [ivHex, authTagHex, ciphertextHex] = encryptedValue.split(':');

  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Encrypted value is malformed');
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
};
