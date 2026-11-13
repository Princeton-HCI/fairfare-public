import { afterEach, describe, expect, it } from 'vitest';
import { verifySignupCode } from './signupCode';
import { supabase } from '@src/lib/server/db';

describe('signupCode', () => {
  // Use a real affiliate_organizations row so the FK on
  // driver_signup_code_attempts is satisfied.
  let organizationId: string;
  const ip = '203.0.113.5';

  const ensureTestOrg = async () => {
    const { data } = await supabase
      .from('affiliate_organizations')
      .upsert(
        { key: 'signup-code-test-org', name: 'Signup Code Test Org', status: 'active' },
        { onConflict: 'key' }
      )
      .select('id')
      .single();
    if (!data) throw new Error('Could not create test org');
    return data.id as string;
  };

  afterEach(async () => {
    if (!organizationId) return;
    await supabase
      .from('driver_signup_code_attempts')
      .delete()
      .eq('organization_id', organizationId);
  });

  it('accepts the correct plaintext code', async () => {
    organizationId = await ensureTestOrg();
    const ok = await verifySignupCode(organizationId, 'hunter2', 'hunter2', ip);
    expect(ok).toEqual({ ok: true });
  });

  it('rejects wrong code and records an attempt', async () => {
    organizationId = await ensureTestOrg();
    const result = await verifySignupCode(organizationId, 'hunter2', 'wrong', ip);
    expect(result).toEqual({ ok: false, reason: 'invalid' });

    const { count } = await supabase
      .from('driver_signup_code_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('ip_address', ip);
    expect(count).toBe(1);
  });

  it('returns no_code_configured when stored code is null', async () => {
    organizationId = await ensureTestOrg();
    const result = await verifySignupCode(organizationId, null, 'whatever', ip);
    expect(result).toEqual({ ok: false, reason: 'no_code_configured' });
  });

  it('rate-limits after 5 failed attempts in the same window', async () => {
    organizationId = await ensureTestOrg();

    for (let i = 0; i < 5; i++) {
      await verifySignupCode(organizationId, 'correct', 'wrong', ip);
    }

    const result = await verifySignupCode(organizationId, 'correct', 'correct', ip);
    expect(result).toEqual({ ok: false, reason: 'rate_limited' });
  });
});
