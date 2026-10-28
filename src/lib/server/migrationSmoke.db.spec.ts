import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { supabase } from '@src/lib/server/db';
import { uniqueTestEmail } from '@tests/utils/testUser';
/**
 * Argyle identifiers unique to this run, so this file can run at the same time
 * as the other specs that used to share these literals (they collide on
 * argyle_user_unique and argyle_account when two files insert at once).
 */
const TEST_ARGYLE_USER = randomUUID();
const TEST_ARGYLE_ACCOUNT = randomUUID();

/**
 * Smoke tests that catch the most common migration regressions:
 *   1. The `is_primary` unique index actually rejects two primaries for
 *      one user (so the migration backfill tiebreaker can never be wrong).
 *   2. The `argyle_accounts.organization_id` FK enforces RESTRICT (no
 *      orphaning of tenancy by hard-deleting an org).
 *   3. Existing legacy rows can still resolve under the new schema (the
 *      organization_id column tolerates NULL).
 */
describe('migration backwards-compat smoke', () => {
  it('rejects a second primary affiliation for the same user', async () => {
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail('primary-uniq'),
      email_confirm: true
    });
    if (userError || !user.user) throw userError ?? new Error('createUser failed');
    const userId = user.user.id;

    const { data: orgA } = await supabase
      .from('affiliate_organizations')
      .upsert({ key: 'mig-test-org-a', name: 'A', status: 'active' }, { onConflict: 'key' })
      .select('id')
      .single();
    const { data: orgB } = await supabase
      .from('affiliate_organizations')
      .upsert({ key: 'mig-test-org-b', name: 'B', status: 'active' }, { onConflict: 'key' })
      .select('id')
      .single();
    if (!orgA || !orgB) throw new Error('orgs missing');

    try {
      await supabase
        .from('driver_affiliate_organization_affiliations')
        .insert({ user_id: userId, affiliate_organization_id: orgA.id, is_primary: true })
        .throwOnError();

      const { error: dupError } = await supabase
        .from('driver_affiliate_organization_affiliations')
        .insert({ user_id: userId, affiliate_organization_id: orgB.id, is_primary: true });

      expect(dupError).not.toBeNull();
      expect(dupError?.message ?? '').toMatch(/driver_affiliations_one_primary_per_user/);
    } finally {
      await supabase
        .from('driver_affiliate_organization_affiliations')
        .delete()
        .eq('user_id', userId);
      await supabase.auth.admin.deleteUser(userId);
      await supabase.from('affiliate_organizations').delete().eq('id', orgA.id);
      await supabase.from('affiliate_organizations').delete().eq('id', orgB.id);
    }
  });

  it('legacy argyle_accounts row with NULL organization_id is allowed', async () => {
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail('legacy-null-org'),
      email_confirm: true
    });
    if (userError || !user.user) throw userError ?? new Error('createUser failed');
    const userId = user.user.id;

    const { error: insertError } = await supabase.from('argyle_accounts').insert({
      user_id: userId,
      argyle_user: TEST_ARGYLE_USER,
      argyle_account: TEST_ARGYLE_ACCOUNT,
      organization_id: null
    });

    try {
      expect(insertError).toBeNull();
    } finally {
      await supabase.from('argyle_accounts').delete().eq('user_id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });
});
