import { randomUUID } from 'crypto';
import { handleWebhook } from './handleWebhook';
import { supabase as serverSupabase } from '@lib/server/db';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import * as processFullSyncExports from './processFullSync';
import * as sendTakeRateMessageIfElegibleToArgyleUserExports from './sendTakeRateMessageIfElegibleToArgyleUser';

import type { ArgyleWebhookResponse } from './types';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';
/**
 * Argyle identifiers unique to this run, so this file can run at the same time
 * as the other specs that used to share these literals (they collide on
 * argyle_user_unique and argyle_account when two files insert at once).
 */
const TEST_ARGYLE_USER = randomUUID();

const USERS_FULLY_SYNCED_WEBHOOK_CALLS_PROCESS_FULL_SYNC_EMAIL = uniqueTestEmail(
  'users-fully-synced-webhook-calls-process-full-sync'
);

describe('incoming users.fully_synced webhook', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'users.fully_synced',
    name: 'users.fully_synced',
    data: {
      user: TEST_ARGYLE_USER,
      resource: {
        id: 'id',
        accounts_connected: [
          'acc1acc1-acc1-acc1-acc1-acc1acc1acc1',
          'acc2acc2-acc2-acc2-acc2-acc2acc2acc2'
        ],
        items_connected: ['item1', 'item2'],
        employers_connected: ['employer1', 'employer2'],
        external_metadata: {},
        external_id: null,
        created_at: 'created_at'
      }
    }
  };

  it('calls processFullSync', async () => {
    // set up test user and profile
    const user = await createTestUserByEmail(
      USERS_FULLY_SYNCED_WEBHOOK_CALLS_PROCESS_FULL_SYNC_EMAIL
    );

    await updateProfileByUserId(serverSupabase, user.id, {
      argyle_user: TEST_ARGYLE_USER
    });

    const processFullSyncSpy = vi.spyOn(processFullSyncExports, 'default').mockResolvedValueOnce();

    const sendTakeRateMessageIfElegibleToArgyleUserSpy = vi
      .spyOn(
        sendTakeRateMessageIfElegibleToArgyleUserExports,
        'sendTakeRateMessageIfElegibleToArgyleUser'
      )
      .mockResolvedValueOnce();

    await handleWebhook(payload);

    expect(processFullSyncSpy).toHaveBeenCalledTimes(1);
    expect(processFullSyncSpy).toHaveBeenCalledWith(payload, { credentials: null });

    expect(sendTakeRateMessageIfElegibleToArgyleUserSpy).toHaveBeenCalledTimes(1);

    await teardownTestUserByUserId(user.id);
  });

  it('sets the account all_gigs_last_synced_at values', async () => {
    // set up test user and profile
    const user = await createTestUserByEmail(
      USERS_FULLY_SYNCED_WEBHOOK_CALLS_PROCESS_FULL_SYNC_EMAIL
    );

    await updateProfileByUserId(serverSupabase, user.id, {
      argyle_user: TEST_ARGYLE_USER
    });

    // set up the user's account
    const { data: argyleAccount, error: insertArgyleAccountError } = await serverSupabase
      .from('argyle_accounts')
      .insert({
        argyle_account: 'acc1acc1-acc1-acc1-acc1-acc1acc1acc1',
        user_id: user.id,
        argyle_user: TEST_ARGYLE_USER
      })
      .select('*')
      .single();
    if (insertArgyleAccountError) throw insertArgyleAccountError;

    expect(argyleAccount?.all_gigs_last_synced_at).toBeNull();

    vi.spyOn(processFullSyncExports, 'default').mockResolvedValueOnce();

    vi.spyOn(
      sendTakeRateMessageIfElegibleToArgyleUserExports,
      'sendTakeRateMessageIfElegibleToArgyleUser'
    ).mockResolvedValueOnce();

    await handleWebhook(payload);

    const { data: updatedArgyleAccount, error: selectUpdatedArgyleAccountError } =
      await serverSupabase
        .from('argyle_accounts')
        .select('*')
        .eq('argyle_account', 'acc1acc1-acc1-acc1-acc1-acc1acc1acc1')
        .single();
    if (!updatedArgyleAccount) throw new Error('Profile not found');
    if (selectUpdatedArgyleAccountError) throw selectUpdatedArgyleAccountError;

    expect(argyleAccount?.all_gigs_last_synced_at).toBeDefined();

    await teardownTestUserByUserId(user.id);
  });
});
