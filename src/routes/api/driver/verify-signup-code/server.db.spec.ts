import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';

const buildEvent = (userId: string | null, body: unknown, ip = '203.0.113.99') =>
  ({
    request: new Request('http://localhost/api/driver/verify-signup-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
    locals: {
      safeGetSession: async () => ({
        user: userId ? ({ id: userId } as { id: string }) : null,
        session: {}
      })
    },
    getClientAddress: () => ip
  }) as unknown as Parameters<typeof POST>[0];

describe('POST /api/driver/verify-signup-code', () => {
  const orgKey = `vsc-${randomUUID().slice(0, 6)}`;
  let orgId: string;
  let userId: string;

  beforeEach(async () => {
    const { data: org } = await supabase
      .from('affiliate_organizations')
      .upsert({ key: orgKey, name: 'VSC', status: 'active' }, { onConflict: 'key' })
      .select('id')
      .single();
    orgId = org!.id;

    const created = await supabase.auth.admin.createUser({
      email: `vsc-${randomUUID()}@test.test`,
      email_confirm: true
    });
    userId = created.data.user!.id;
  });

  afterEach(async () => {
    await supabase.from('driver_signup_code_attempts').delete().eq('organization_id', orgId);
    await supabase.auth.admin.deleteUser(userId);
    await supabase.from('affiliate_organizations').delete().eq('id', orgId);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await POST(buildEvent(null, { orgKey, code: 'whatever' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 on missing orgKey or code', async () => {
    expect((await POST(buildEvent(userId, { orgKey }))).status).toBe(400);
    expect((await POST(buildEvent(userId, { code: 'x' }))).status).toBe(400);
  });

  it('returns 200 when org has no signup code configured', async () => {
    const response = await POST(buildEvent(userId, { orgKey, code: 'anything' }));
    expect(response.status).toBe(200);
  });

  it('returns 200 with { ok: true } for the correct code', async () => {
    await supabase
      .from('affiliate_organizations')
      .update({ driver_signup_code: 'correct-code' })
      .eq('id', orgId);

    const response = await POST(buildEvent(userId, { orgKey, code: 'correct-code' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('returns 403 for the wrong code', async () => {
    await supabase
      .from('affiliate_organizations')
      .update({ driver_signup_code: 'correct-code' })
      .eq('id', orgId);

    const response = await POST(buildEvent(userId, { orgKey, code: 'wrong' }));
    expect(response.status).toBe(403);
  });

  it('does NOT create an affiliation on success', async () => {
    await supabase
      .from('affiliate_organizations')
      .update({ driver_signup_code: 'correct-code' })
      .eq('id', orgId);

    await POST(buildEvent(userId, { orgKey, code: 'correct-code' }));

    const { count } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    expect(count).toBe(0);
  });

  it('returns 429 after 5 failed attempts in the same window', async () => {
    await supabase
      .from('affiliate_organizations')
      .update({ driver_signup_code: 'correct-code' })
      .eq('id', orgId);

    // 5 failures
    for (let i = 0; i < 5; i++) {
      await POST(buildEvent(userId, { orgKey, code: 'wrong' }));
    }

    // 6th attempt — even with the correct code, rate-limited
    const response = await POST(buildEvent(userId, { orgKey, code: 'correct-code' }));
    expect(response.status).toBe(429);
  });
});
