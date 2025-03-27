import { describe, test, expect, vi } from 'vitest';
import syncAccountData from '@src/lib/syncAccountData';
import { supabase } from '@src/lib/server/db';
import * as argyle from '@src/lib/server/argyle';
import { generateMockedDriverActivity } from '@src/mocks/activities';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';

type DriverActivity = SupabaseRows['argyle_driver_activities'];

const account = 'abc1-a1b2-c3d4-e5f6-abc1a1b2c3d4e5f6';
const mockedActivities: DriverActivity[] = [
  generateMockedDriverActivity({ account }),
  generateMockedDriverActivity({ account })
];

describe('syncAccountData', () => {
  test('updates last synced timestamp when shouldUpdateAllGigsLastSyncedAt is undefined', async () => {
    const start = new Date();
    const user = await createTestUserByEmail(
      'syncaccountdata_shouldupdateallgigslastsyncedat_true@test.test'
    );

    // create account
    const { error: accountInsertError } = await supabase.from('argyle_accounts').insert({
      argyle_account: account,
      user_id: user.id,
      argyle_user: 'aaaaaaaa-bbbb-cccc-aaaa-000000000000'
    });
    if (accountInsertError) throw accountInsertError;

    vi.spyOn(argyle, 'getActivities').mockResolvedValueOnce(mockedActivities);

    await syncAccountData(account);

    const { data: updatedAccountData, error: accountUpdateError } = await supabase
      .from('argyle_accounts')
      .select('all_gigs_last_synced_at')
      .eq('argyle_account', account)
      .single();
    if (accountUpdateError) throw accountUpdateError;

    const lastSyncedAt = new Date(updatedAccountData.all_gigs_last_synced_at);
    expect(lastSyncedAt.getTime()).toBeGreaterThan(start.getTime());

    await teardownTestUserByUserId(user.id);
  });

  test('skips timestamp update when shouldUpdateAllGigsLastSyncedAt is false', async () => {
    const start = new Date();
    const user = await createTestUserByEmail(
      'syncaccountdata_shouldupdateallgigslastsyncedat_false@test.test'
    );

    // create account
    const { error: accountInsertError } = await supabase.from('argyle_accounts').insert({
      argyle_account: account,
      user_id: user.id,
      argyle_user: 'aaaaaaaa-bbbb-cccc-aaaa-000000000000',
      all_gigs_last_synced_at: start
    });
    if (accountInsertError) throw accountInsertError;

    vi.spyOn(argyle, 'getActivities').mockResolvedValueOnce(mockedActivities);

    await syncAccountData(account, false);

    const { data: updatedAccountData, error: accountUpdateError } = await supabase
      .from('argyle_accounts')
      .select('all_gigs_last_synced_at')
      .eq('argyle_account', account)
      .single();
    if (accountUpdateError) throw accountUpdateError;

    const lastSyncedAt = new Date(updatedAccountData.all_gigs_last_synced_at);
    expect(lastSyncedAt.getTime()).toEqual(start.getTime());

    await teardownTestUserByUserId(user.id);
  });
});
