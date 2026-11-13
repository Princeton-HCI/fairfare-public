import { randomUUID } from 'crypto';
import { describe, test, expect, vi } from 'vitest';
import syncAccountData from '@src/lib/syncAccountData';
import { supabase } from '@src/lib/server/db';
import * as argyle from '@src/lib/server/argyle';
import { generateMockedFlattenedArgyleGig } from '@tests/mocks/activities';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import type { FlattenedArgyleGig } from '@src/lib/types';
/**
 * Argyle identifiers unique to this run, so this file can run at the same time
 * as the other specs that used to share these literals (they collide on
 * argyle_user_unique and argyle_account when two files insert at once).
 */
const TEST_ARGYLE_USER = randomUUID();

const account = 'abc1-a1b2-c3d4-e5f6-abc1a1b2c3d4e5f6';
const mockedFlattenedGigs: FlattenedArgyleGig[] = [
  generateMockedFlattenedArgyleGig({ account }),
  generateMockedFlattenedArgyleGig({ account })
];

describe('syncAccountData', () => {
  test('updates last synced timestamp when shouldUpdateAllGigsLastSyncedAt is undefined', async () => {
    const start = new Date();
    const user = await createTestUserByEmail(
      uniqueTestEmail('syncaccountdata-shouldupdateallgigslastsyncedat-true')
    );

    // create account
    const { error: accountInsertError } = await supabase.from('argyle_accounts').insert({
      argyle_account: account,
      user_id: user.id,
      argyle_user: TEST_ARGYLE_USER
    });
    if (accountInsertError) throw accountInsertError;

    vi.spyOn(argyle, 'getFlattenedArgyleGigs').mockResolvedValueOnce(mockedFlattenedGigs);

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
      uniqueTestEmail('syncaccountdata-shouldupdateallgigslastsyncedat-false')
    );

    // create account
    const { error: accountInsertError } = await supabase.from('argyle_accounts').insert({
      argyle_account: account,
      user_id: user.id,
      argyle_user: TEST_ARGYLE_USER,
      all_gigs_last_synced_at: start
    });
    if (accountInsertError) throw accountInsertError;

    vi.spyOn(argyle, 'getFlattenedArgyleGigs').mockResolvedValueOnce(mockedFlattenedGigs);

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
