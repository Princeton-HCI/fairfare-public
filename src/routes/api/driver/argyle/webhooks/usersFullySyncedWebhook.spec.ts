import { handleWebhook } from './handleWebhook';
import { supabase as serverSupabase } from '@lib/server/db';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import * as processFullSyncExports from './processFullSync';
import * as sendTakeRateMessageIfElegibleToArgyleUserExports from './sendTakeRateMessageIfElegibleToArgyleUser';

import type { ArgyleWebhookResponse } from './types';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';

describe('incoming users.fully_synced webhook', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'users.fully_synced',
    name: 'users.fully_synced',
    data: {
      user: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
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
      'users.fully_synced_webhook_calls_process_full_sync@test.test'
    );

    await updateProfileByUserId(serverSupabase, user.id, {
      argyle_user: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
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
    expect(processFullSyncSpy).toHaveBeenCalledWith(payload);

    expect(sendTakeRateMessageIfElegibleToArgyleUserSpy).toHaveBeenCalledTimes(1);

    await teardownTestUserByUserId(user.id);
  });

  it('sets the account all_gigs_last_synced_at values', async () => {
    // set up test user and profile
    const user = await createTestUserByEmail(
      'users.fully_synced_webhook_calls_process_full_sync@test.test'
    );

    await updateProfileByUserId(serverSupabase, user.id, {
      argyle_user: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    });

    // set up the user's account
    const { data: argyleAccount, error: insertArgyleAccountError } = await serverSupabase
      .from('argyle_accounts')
      .insert({
        argyle_account: 'acc1acc1-acc1-acc1-acc1-acc1acc1acc1',
        user_id: user.id,
        argyle_user: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
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
