import { randomBytes, timingSafeEqual } from 'crypto';
import { supabase } from '@src/lib/server/db';

/** New organizer signup code (8 hex chars). Used on create and on rotate. */
export const generateSignupCode = (): string => randomBytes(4).toString('hex');

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

const compareCode = (plaintext: string, stored: string): boolean => {
  const candidate = Buffer.from(plaintext, 'utf8');
  const expected = Buffer.from(stored, 'utf8');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
};

const recordAttempt = async (organizationId: string, ipAddress: string) => {
  await supabase
    .from('driver_signup_code_attempts')
    .insert({ organization_id: organizationId, ip_address: ipAddress });
};

const recentFailedAttempts = async (organizationId: string, ipAddress: string) => {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('driver_signup_code_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('ip_address', ipAddress)
    .gte('attempted_at', since);
  if (error) {
    console.error('Error counting signup code attempts:', error);
    return 0;
  }
  return count ?? 0;
};

export type SignupCodeVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited' | 'invalid' | 'no_code_configured' };

export const verifySignupCode = async (
  organizationId: string,
  storedCode: string | null,
  plaintext: string | undefined,
  ipAddress: string
): Promise<SignupCodeVerifyResult> => {
  if (!storedCode) return { ok: false, reason: 'no_code_configured' };

  if ((await recentFailedAttempts(organizationId, ipAddress)) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { ok: false, reason: 'rate_limited' };
  }

  if (!plaintext || !compareCode(plaintext, storedCode)) {
    await recordAttempt(organizationId, ipAddress);
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true };
};
