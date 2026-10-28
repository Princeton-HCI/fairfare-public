import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '@src/lib/server/db';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';

describe('study affiliation with existing primary org', () => {
  let testUser: { id: string };
  let orgAId: string;
  let orgBId: string;
  const orgAKey = 'test-primary-conflict-a';
  const orgBKey = 'test-primary-conflict-b';

  beforeAll(async () => {
    testUser = await createTestUserByEmail(uniqueTestEmail('study-primary-conflict'));

    const { data: orgA, error: errA } = await supabase
      .from('affiliate_organizations')
      .upsert({ key: orgAKey, name: 'Org A' }, { onConflict: 'key' })
      .select('id')
      .single();
    if (errA) throw errA;
    orgAId = orgA.id;

    const { data: orgB, error: errB } = await supabase
      .from('affiliate_organizations')
      .upsert({ key: orgBKey, name: 'Org B' }, { onConflict: 'key' })
      .select('id')
      .single();
    if (errB) throw errB;
    orgBId = orgB.id;
  });

  afterAll(async () => {
    if (testUser) {
      await supabase
        .from('driver_affiliate_organization_affiliations')
        .delete()
        .eq('user_id', testUser.id);
      await supabase
        .from('driver_affiliate_organization_data_sharing_consents')
        .delete()
        .eq('user_id', testUser.id);
      await teardownTestUserByUserId(testUser.id);
    }
    await supabase.from('affiliate_organizations').delete().eq('key', orgAKey);
    await supabase.from('affiliate_organizations').delete().eq('key', orgBKey);
  });

  it('creates a secondary affiliation when driver already has a different primary org', async () => {
    const { error: primaryInsertError } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .insert({
        user_id: testUser.id,
        affiliate_organization_id: orgAId,
        is_primary: true
      });
    expect(primaryInsertError).toBeNull();

    // Simulate what insertAffiliateOrganizationAffiliation does: check existing primary, then upsert
    const { data: existingPrimary } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .select('affiliate_organization_id')
      .eq('user_id', testUser.id)
      .eq('is_primary', true)
      .maybeSingle();

    const shouldBePrimary =
      !existingPrimary || existingPrimary.affiliate_organization_id === orgBId;
    expect(shouldBePrimary).toBe(false);

    const { error: upsertError } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .upsert(
        {
          user_id: testUser.id,
          affiliate_organization_id: orgBId,
          is_primary: shouldBePrimary
        },
        { onConflict: 'user_id,affiliate_organization_id' }
      );

    expect(upsertError).toBeNull();

    const { data: allAffiliations } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .select('affiliate_organization_id, is_primary')
      .eq('user_id', testUser.id)
      .order('is_primary', { ascending: false });

    expect(allAffiliations).toHaveLength(2);
    expect(allAffiliations![0]).toEqual({
      affiliate_organization_id: orgAId,
      is_primary: true
    });
    expect(allAffiliations![1]).toEqual({
      affiliate_organization_id: orgBId,
      is_primary: false
    });
  });
});
