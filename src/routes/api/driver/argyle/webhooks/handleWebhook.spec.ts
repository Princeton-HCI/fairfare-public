import * as argyle from '@src/lib/server/argyle';
import { supabase } from '@src/lib/server/db';
import { generateMockedDriverActivity } from '@src/mocks/activities';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';

import { handleWebhook } from './handleWebhook';
import * as handlePostSync from './handlePostSync';
import * as sendTakeRateMessageIfElegibleToArgyleUser from './sendTakeRateMessageIfElegibleToArgyleUser';
import type { ArgyleWebhookResponse } from './types';

type DriverActivity = SupabaseRows['argyle_driver_activities'];

const account = 'aaaaaaaa-bbbb-cccc-aaaa-aaaaaaaaaaaa';
const mockedActivities: DriverActivity[] = [
  generateMockedDriverActivity({ account }),
  generateMockedDriverActivity({ account })
];

describe('when 30 days of gigs have synced [partially_synced]', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'gigs.partially_synced',
    name: 'gigs.partially_synced',
    data: {
      account: 'aaaaaaaa-bbbb-cccc-aaaa-aaaaaaaaaaaa',
      user: 'aaaaaaaa-bbbb-cccc-aaaa-000000000000',
      available_from: '2023-08-23T20:59:28Z',
      available_to: '2023-10-18T09:30:35Z',
      available_count: 149,
      days_synced: 10
    }
  };

  beforeAll(() => {
    vi.spyOn(argyle, 'getActivities').mockResolvedValueOnce(mockedActivities);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates the received_argyle_webhooks table', async () => {
    vi.restoreAllMocks();

    // delete all rows from the table
    const { error: deleteError } = await supabase
      .from('received_argyle_webhooks')
      .delete()
      .neq('response', null);

    expect(deleteError).toBeNull();

    // make a test user
    const user = await createTestUserByEmail('updatesthereceived_argyle_webhookstable@test.test');

    // make an an argyle_account row with this argyle_account
    const { error } = await supabase.from('argyle_accounts').insert({
      argyle_account: 'aaaaaaaa-bbbb-cccc-aaaa-aaaaaaaaaaaa',
      user_id: user.id,
      argyle_user: 'aaaaaaaa-bbbb-cccc-aaaa-000000000000'
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
    const { data } = await supabase.from('received_argyle_webhooks').select('*');
    expect(data).toHaveLength(1);

    // delete all rows from the table
    const { error: secondDeleteError } = await supabase
      .from('received_argyle_webhooks')
      .delete()
      .neq('response', null);
    expect(secondDeleteError).toBeNull();
  });

  it('calls handlePostSync on sync', async () => {
    vi.spyOn(argyle, 'getActivities').mockResolvedValueOnce(mockedActivities);

    const handlePostSyncSpy = vi.spyOn(handlePostSync, 'default').mockResolvedValueOnce();

    // make a test user
    const user = await createTestUserByEmail(
      'calls_send_survey_if_elegible_to_argyle_user_on_sync@test.test'
    );

    // make an an argyle_account row with this argyle_account
    const { error } = await supabase.from('argyle_accounts').insert({
      argyle_account: 'aaaaaaaa-bbbb-cccc-aaaa-aaaaaaaaaaaa',
      user_id: user.id,
      argyle_user: 'aaaaaaaa-bbbb-cccc-aaaa-000000000000'
    });
    expect(error).toBeNull();

    await handleWebhook(payload);

    // teardown and check
    await teardownTestUserByUserId(user.id);

    expect(handlePostSyncSpy).toHaveBeenCalledTimes(1);
    expect(handlePostSyncSpy).toHaveBeenCalledWith('aaaaaaaa-bbbb-cccc-aaaa-000000000000');
  });
});
