import { randomUUID } from 'crypto';
import * as argyle from '@src/lib/server/argyle';
import { supabase } from '@src/lib/server/db';
import { generateMockedFlattenedArgyleGig } from '@tests/mocks/activities';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';

import { handleWebhook } from './handleWebhook';
import * as handlePostSync from './handlePostSync';
import * as sendTakeRateMessageIfElegibleToArgyleUser from './sendTakeRateMessageIfElegibleToArgyleUser';
import type { ArgyleWebhookResponse } from './types';

import type { FlattenedArgyleGig } from '@src/lib/types';
/**
 * Argyle identifiers unique to this run, so this file can run at the same time
 * as the other specs that used to share these literals (they collide on
 * argyle_user_unique and argyle_account when two files insert at once).
 */
const TEST_ARGYLE_USER = randomUUID();

const account = 'aaaaaaaa-bbbb-cccc-aaaa-aaaaaaaaaaaa';
const mockedFlattenedGigs: FlattenedArgyleGig[] = [
  generateMockedFlattenedArgyleGig({ account }),
  generateMockedFlattenedArgyleGig({ account })
];

describe('when 30 days of gigs have synced [partially_synced]', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'gigs.partially_synced',
    name: 'gigs.partially_synced',
    data: {
      account: 'aaaaaaaa-bbbb-cccc-aaaa-aaaaaaaaaaaa',
      user: TEST_ARGYLE_USER,
      available_from: '2023-08-23T20:59:28Z',
      available_to: '2023-10-18T09:30:35Z',
      available_count: 149,
      days_synced: 10
    }
  };

  beforeAll(() => {
    vi.spyOn(argyle, 'getFlattenedArgyleGigs').mockResolvedValueOnce(mockedFlattenedGigs);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates the received_argyle_webhooks table', async () => {
    vi.restoreAllMocks();

    // Rows are matched on the payload's argyle user, which is unique to this
    // run. This used to delete every row in the table and count what was left,
    // which both destroyed other specs' rows and miscounted when they added
    // their own at the same moment.
    const ourWebhooks = () =>
      supabase
        .from('received_argyle_webhooks')
        .select('*')
        .eq('response->data->>user', TEST_ARGYLE_USER);

    // make a test user
    const user = await createTestUserByEmail(
      uniqueTestEmail('updatesthereceived-argyle-webhookstable')
    );

    // make an an argyle_account row with this argyle_account
    const { error } = await supabase.from('argyle_accounts').insert({
      argyle_account: 'aaaaaaaa-bbbb-cccc-aaaa-aaaaaaaaaaaa',
      user_id: user.id,
      argyle_user: TEST_ARGYLE_USER
    });
    expect(error).toBeNull();

    // spoof the sendTakeRateMessageIfElegibleToArgyleUser function
    vi.spyOn(
      sendTakeRateMessageIfElegibleToArgyleUser,
      'sendTakeRateMessageIfElegibleToArgyleUser'
    ).mockResolvedValueOnce();

    // call the function
    await handleWebhook(payload);

    // teardown the test user
    await teardownTestUserByUserId(user.id);

    // check that the table has a new row
    const { data } = await ourWebhooks();
    expect(data).toHaveLength(1);

    const { error: cleanupError } = await supabase
      .from('received_argyle_webhooks')
      .delete()
      .eq('response->data->>user', TEST_ARGYLE_USER);
    expect(cleanupError).toBeNull();
  });

  it('calls handlePostSync on sync', async () => {
    vi.spyOn(argyle, 'getFlattenedArgyleGigs').mockResolvedValueOnce(mockedFlattenedGigs);

    const handlePostSyncSpy = vi.spyOn(handlePostSync, 'default').mockResolvedValueOnce();

    // make a test user
    const user = await createTestUserByEmail(
      uniqueTestEmail('calls-send-survey-if-elegible-to-argyle-user-on-sync')
    );

    // make an an argyle_account row with this argyle_account
    const { error } = await supabase.from('argyle_accounts').insert({
      argyle_account: 'aaaaaaaa-bbbb-cccc-aaaa-aaaaaaaaaaaa',
      user_id: user.id,
      argyle_user: TEST_ARGYLE_USER
    });
    expect(error).toBeNull();

    await handleWebhook(payload);

    // teardown and check
    await teardownTestUserByUserId(user.id);

    expect(handlePostSyncSpy).toHaveBeenCalledTimes(1);
    expect(handlePostSyncSpy).toHaveBeenCalledWith(TEST_ARGYLE_USER);
  });
});
