import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';

const buildRequest = (body: unknown) =>
  new Request('http://localhost/api/driver/affiliate-primary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

const buildEvent = (userId: string | null, body: unknown) =>
  ({
    request: buildRequest(body),
    locals: {
      safeGetSession: async () => ({
        user: userId ? ({ id: userId } as { id: string }) : null,
        session: {}
      })
    },
    getClientAddress: () => '198.51.100.5'
  }) as unknown as Parameters<typeof POST>[0];

describe('POST /api/driver/affiliate-primary', () => {
  const orgKeyA = `aff-p-a-${randomUUID().slice(0, 6)}`;
  const orgKeyB = `aff-p-b-${randomUUID().slice(0, 6)}`;
  let orgA: string;
  let orgB: string;
  let userId: string;

  beforeEach(async () => {
    const a = await supabase
      .from('affiliate_organizations')
      .upsert({ key: orgKeyA, name: 'A', status: 'active' }, { onConflict: 'key' })
      .select('id')
      .single();
    const b = await supabase
      .from('affiliate_organizations')
      .upsert({ key: orgKeyB, name: 'B', status: 'active' }, { onConflict: 'key' })
      .select('id')
      .single();
    orgA = a.data!.id;
    orgB = b.data!.id;

    const created = await supabase.auth.admin.createUser({
      email: `aff-p-test-${randomUUID()}@test.test`,
      email_confirm: true
    });
    userId = created.data.user!.id;
  });

  afterEach(async () => {
    await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .delete()
      .eq('user_id', userId);
    await supabase
      .from('driver_affiliate_organization_affiliations')
      .delete()
      .eq('user_id', userId);
    await supabase.auth.admin.deleteUser(userId);
    await supabase.from('affiliate_organizations').delete().in('id', [orgA, orgB]);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await POST(buildEvent(null, { orgKey: orgKeyA }));
    expect(response.status).toBe(401);
  });

  it('creates a primary affiliation + consent', async () => {
    const response = await POST(buildEvent(userId, { orgKey: orgKeyA }));
    expect(response.status).toBe(200);

    const { data: aff } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .select('is_primary, affiliate_organization_id')
      .eq('user_id', userId);
    expect(aff).toHaveLength(1);
    expect(aff![0].is_primary).toBe(true);
    expect(aff![0].affiliate_organization_id).toBe(orgA);

    const { data: cons } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .select('affiliate_organization_id')
      .eq('user_id', userId);
    expect(cons).toHaveLength(1);
  });

  it('rejects a second primary for a different org with 409', async () => {
    await POST(buildEvent(userId, { orgKey: orgKeyA }));
    const response = await POST(buildEvent(userId, { orgKey: orgKeyB }));
    expect(response.status).toBe(409);
  });

  it('rejects a wrong signup code with 403', async () => {
    await supabase
      .from('affiliate_organizations')
      .update({ driver_signup_code: 'correct-code' })
      .eq('id', orgA);

    const response = await POST(buildEvent(userId, { orgKey: orgKeyA, signupCode: 'wrong' }));
    expect(response.status).toBe(403);
  });

  it('accepts the correct signup code', async () => {
    await supabase
      .from('affiliate_organizations')
      .update({ driver_signup_code: 'correct-code' })
      .eq('id', orgA);

    const response = await POST(
      buildEvent(userId, { orgKey: orgKeyA, signupCode: 'correct-code' })
    );
    expect(response.status).toBe(200);
  });

  it('rejects empty orgKey with 400', async () => {
    const response = await POST(buildEvent(userId, { orgKey: '' }));
    expect(response.status).toBe(400);
  });
});
