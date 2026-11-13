import { fetchJsonOrThrow } from '@src/lib/client/fetchJson';

export const createPrimaryDriverAffiliation = async ({
  orgKey,
  signupCode = null
}: {
  orgKey: string;
  signupCode?: string | null;
}) =>
  fetchJsonOrThrow<{ success: boolean }>(
    '/api/driver/affiliate-primary',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgKey, signupCode })
    },
    'Could not start data sharing'
  );

export const createSecondaryDriverAffiliation = async ({
  orgKey,
  signupCode = null
}: {
  orgKey: string;
  signupCode?: string | null;
}) =>
  fetchJsonOrThrow<{ success: boolean }>(
    '/api/driver/affiliate-secondary',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgKey, signupCode })
    },
    'Failed to add organization'
  );

export const verifyDriverSignupCode = async (orgKey: string, code: string) =>
  fetchJsonOrThrow<{ ok: true }>(
    '/api/driver/verify-signup-code',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgKey, code })
    },
    'Could not verify code, please try again.'
  );
