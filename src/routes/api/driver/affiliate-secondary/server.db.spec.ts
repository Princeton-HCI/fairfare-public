import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { POST as POST_SECONDARY } from './+server';
import { POST as POST_PRIMARY } from '../affiliate-primary/+server';
import { supabase } from '@src/lib/server/db';

const buildEvent = (POST: typeof POST_SECONDARY, userId: string | null, body: unknown) =>
  ({
    request: new Request('http://localhost', {
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
    getClientAddress: () => '198.51.100.6'
  }) as unknown as Parameters<typeof POST>[0];

describe('POST /api/driver/affiliate-secondary', () => {
  const orgKeyA = `aff-s-a-${randomUUID().slice(0, 6)}`;
  const orgKeyB = `aff-s-b-${randomUUID().slice(0, 6)}`;
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
      email: `aff-s-test-${randomUUID()}@test.test`,
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

  it('rejects when the driver has NO primary affiliation (400)', async () => {
    const response = await POST_SECONDARY(buildEvent(POST_SECONDARY, userId, { orgKey: orgKeyB }));
    expect(response.status).toBe(400);
  });

  it('creates a secondary affiliation when primary exists', async () => {
    await POST_PRIMARY(buildEvent(POST_PRIMARY, userId, { orgKey: orgKeyA }));

    const response = await POST_SECONDARY(buildEvent(POST_SECONDARY, userId, { orgKey: orgKeyB }));
    expect(response.status).toBe(200);

    const { data: aff } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .select('is_primary, affiliate_organization_id')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false });
    expect(aff).toHaveLength(2);
    expect(aff![0].is_primary).toBe(true);
    expect(aff![0].affiliate_organization_id).toBe(orgA);
    expect(aff![1].is_primary).toBe(false);
    expect(aff![1].affiliate_organization_id).toBe(orgB);
  });

  it('rejects adding the same org as both primary and secondary (409)', async () => {
    await POST_PRIMARY(buildEvent(POST_PRIMARY, userId, { orgKey: orgKeyA }));
    const response = await POST_SECONDARY(buildEvent(POST_SECONDARY, userId, { orgKey: orgKeyA }));
    expect(response.status).toBe(409);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await POST_SECONDARY(buildEvent(POST_SECONDARY, null, { orgKey: orgKeyA }));
    expect(response.status).toBe(401);
  });
});
