import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import * as argyle from '@src/lib/server/argyle';
import { supabase } from '@src/lib/server/db';
import * as sendSmsMessageToUserNow from '@src/lib/smsMessages/sendSmsMessageToUserNow';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';

import * as handleDuplicateUser from './handleDuplicateUser';
import { handleWebhook } from './handleWebhook';

import type { ArgyleWebhookResponse } from './types';

const argyleFetchIdentityResponseTestyMcTesterson = {
  id: 'ff55ff55-ff55-ff55-ff55-ff55ff55ff55',
  account: 'ff55ff55-ff55-ff55-ff55-ff55ff55ff55',
  address: {
    city: 'Los Angeles',
    line1: '456 Oak Street',
    line2: 'Apt 12B',
    state: 'CA',
    country: 'US',
    postal_code: '90001'
  },
  first_name: 'Testy',
  last_name: 'McTesterson',
  full_name: 'Testy McTesterson',
  birth_date: '1990-04-01',
  email: 'testy.mctesterson@argyle.com',
  phone_number: '+18005555555',
  picture_url: 'https://example.com/testy.png',
  employment_status: 'active',
  employment_type: 'full-time',
  job_title: 'Software Engineer',
  ssn: '123-45-6789',
  marital_status: 'Single',
  gender: 'Male',
  hire_date: '2022-01-15',
  termination_date: '2024-01-01',
  termination_reason: null,
  employer: 'TechCorp',
  base_pay: { amount: 90000, period: 'year', currency: 'USD' },
  pay_cycle: 'monthly',
  platform_ids: {
    employee_id: 'EMP12345',
    position_id: 'POSITION001',
    platform_user_id: 'PLATFORM_USER_12345'
  },
  created_at: '2024-01-01T12:00:00.000Z',
  updated_at: '2024-01-01T12:30:00.000Z',
  metadata: {}
};

describe('incoming identities.added webhook for a user whose phone number is already used', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'identities.added',
    name: 'ALL_development',
    data: {
      account: '44114411-4411-4411-4411-441144114411',
      user: 'a457a457-a457-a457-a457-a457a457a457',
      identity: '09bc09bc-09bc-09bc-09bc-09bc09bc09bc'
    }
  };

  test('sends the account_already_exists sms to the user and retains only the older profile record', async () => {
    // reset sms messages
    await supabase.from('sms_messages').delete().neq('message', null);

    const firstUser = await createTestUserByEmail(
      'incoming.identities.added.initial_user_created@test.test'
    );

    await updateProfileByUserId(supabase, firstUser.id, {
      argyle_user: 'a457a457-a457-a457-a457-a457a457a457'
    });

    // mock the response the first time
    vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(
      argyleFetchIdentityResponseTestyMcTesterson
    );

    // run the payload the first time with the first argyle_user
    await handleWebhook(payload);

    // e.g., wait three months and the user comes back to ff

    const secondUser = await createTestUserByEmail(
      'incoming.identities.added.second_user@test.test'
    );

    await updateProfileByUserId(supabase, secondUser.id, {
      argyle_user: 'b568b568-b568-b568-b568-b568b568b568'
    });

    // Here we want to change the response's email to isolate the sms conflict
    const secondFetchIdentityResponse = {
      ...argyleFetchIdentityResponseTestyMcTesterson,
      email: 'ignore_me@gmail.com',
      address: {
        city: 'Denver',
        line1: '123 Elm Street',
        line2: 'Unit 5A',
        state: 'CO',
        country: 'US',
        postal_code: '80202'
      }
    };

    // mock the response the second time
    vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(secondFetchIdentityResponse);

    // run the payload the second time with a new argyle_user
    const secondPayload = {
      ...payload,
      data: {
        account: '44114411-4411-4411-4411-441144114411',
        user: 'b568b568-b568-b568-b568-b568b568b568',
        identity: '09bc09bc-09bc-09bc-09bc-09bc09bc09bc'
      }
    };

    // in this moment, e.g., immediately before the webhook arrives, both profiles should exist
    const { data: firstCountData, error: firstCountError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', [firstUser.id, secondUser.id]);

    if (firstCountError) throw firstCountError;
    expect(firstCountData.length).toBe(2);

    const messageSendSpy = vi.spyOn(sendSmsMessageToUserNow, 'default').mockResolvedValueOnce();
    const handleDuplicateUserSpy = vi.spyOn(handleDuplicateUser, 'default');

    await handleWebhook(secondPayload);

    // expect handleDuplicateUser to have been called
    expect(handleDuplicateUserSpy).toHaveBeenCalledTimes(1);
    expect(handleDuplicateUserSpy).toHaveBeenCalledWith(
      'b568b568-b568-b568-b568-b568b568b568',
      secondFetchIdentityResponse,
      'phone'
    );

    // now we expect only one profile to exist
    const { data: secondCountData, error: secondCountError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', [firstUser.id, secondUser.id]);

    if (secondCountError) throw secondCountError;
    expect(secondCountData?.length).toBe(1);

    // and that profile should be the older one
    expect(secondCountData[0].user_id).toBe(firstUser.id);

    // ...and that the profile's data has *NOT* changed despite the webhook
    // containing different data
    expect(secondCountData[0].address).toEqual(
      '456 Oak Street, Apt 12B, Los Angeles, CA, 90001, US'
    );

    // confirm that the sms was sent with the right params by checking the db
    expect(messageSendSpy).toHaveBeenCalledTimes(1);
    expect(messageSendSpy).toHaveBeenCalledWith(firstUser.id, 'account_already_exists', {});

    // teardown first user (second user has been deleted by the function under test)
    await teardownTestUserByUserId(firstUser.id);
  });
});

describe('incoming identities.added webhook for a user whose email is already used', () => {
  // TODO: update this based on the above test
  const payload: ArgyleWebhookResponse = {
    event: 'identities.added',
    name: 'ALL_development',
    data: {
      account: '44114411-4411-4411-4411-441144114411',
      user: '09123232-a457-a457-a457-09123232a457',
      identity: '09bc09bc-09bc-09bc-09bc-09bc09bc09bc'
    }
  };

  test('sends the account_already_exists sms to the user and retains only the older profile record', async () => {
    // reset sms messages
    await supabase.from('sms_messages').delete().neq('message', null);

    const user = await createTestUserByEmail(
      'incoming.identities.added.emailinitial_user_created@test.test'
    );

    await updateProfileByUserId(supabase, user.id, {
      argyle_user: '09123232-a457-a457-a457-09123232a457'
    });

    // mock the response the first time
    vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(
      argyleFetchIdentityResponseTestyMcTesterson
    );

    // run the payload the first time with the first argyle_user
    await handleWebhook(payload);

    // e.g., wait three months and the user comes back to ff

    const secondUser = await createTestUserByEmail(
      'incoming.identities.added.emailsecond_user@test.test'
    );

    await updateProfileByUserId(supabase, secondUser.id, {
      argyle_user: 'ab9e092c-b568-b568-b568-ab9e092cb568'
    });

    // Here we want to change the response's phone to isolate the email conflict
    const secondFetchIdentityResponse = {
      ...argyleFetchIdentityResponseTestyMcTesterson,
      phone_number: '+10000000000'
    };

    // mock the response the second time
    vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(secondFetchIdentityResponse);

    // run the payload the second time with a new argyle_user
    const secondPayload = {
      ...payload,
      data: {
        account: '44114411-4411-4411-4411-441144114411',
        user: 'ab9e092c-b568-b568-b568-ab9e092cb568',
        identity: '09bc09bc-09bc-09bc-09bc-09bc09bc09bc'
      }
    };

    // in this moment, e.g., immediately before the webhook arrives, both profiles should exist
    const { data: firstCountData, error: firstCountError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', [user.id, secondUser.id]);

    if (firstCountError) throw firstCountError;
    expect(firstCountData.length).toBe(2);

    const messageSendSpy = vi.spyOn(sendSmsMessageToUserNow, 'default').mockResolvedValueOnce();
    const handleDuplicateUserSpy = vi.spyOn(handleDuplicateUser, 'default');

    await handleWebhook(secondPayload);

    // expect handleDuplicateUser to have been called
    expect(handleDuplicateUserSpy).toHaveBeenCalledTimes(1);
    expect(handleDuplicateUserSpy).toHaveBeenCalledWith(
      'ab9e092c-b568-b568-b568-ab9e092cb568',
      secondFetchIdentityResponse,
      'email'
    );

    // now we expect only one profile to exist
    const { data: secondCountData, error: secondCountError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', [user.id, secondUser.id]);

    if (secondCountError) throw secondCountError;
    expect(secondCountData?.length).toBe(1);

    // and that profile should be the older one
    expect(secondCountData[0].user_id).toBe(user.id);

    // confirm that the sms was sent with the right params by checking the db
    expect(messageSendSpy).toHaveBeenCalledTimes(1);
    expect(messageSendSpy).toHaveBeenCalledWith(user.id, 'account_already_exists', {});

    // teardown first user (second user has been deleted by the function under test)
    await teardownTestUserByUserId(user.id);
  });
});
