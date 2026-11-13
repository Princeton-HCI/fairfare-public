import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import * as argyle from '@src/lib/server/argyle';
import { supabase } from '@src/lib/server/db';
import {
  createTestUserByPhone,
  teardownTestUserByUserId,
  uniqueTestPhone
} from '@tests/utils/testUser';

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
      user: '09123232-a457-a457-a457-09123232a457',
      identity: '09bc09bc-09bc-09bc-09bc-09bc09bc09bc'
    }
  };

  test('updates the user identity data without the email or phone number', async () => {
    // Numbers of this test's own: '19995559999' is pinned to a fixed OTP in
    // supabase/config.toml and is needed by the auth specs, and a hardcoded
    // number survives in auth.users when a run fails before teardown, so the
    // next run collides on users_phone_key.
    const FIRST_USER_PHONE = uniqueTestPhone();
    const SECOND_USER_PHONE = uniqueTestPhone();

    const firstUser = await createTestUserByPhone(FIRST_USER_PHONE);

    await updateProfileByUserId(supabase, firstUser.id, {
      argyle_user: '09123232-a457-a457-a457-09123232a457'
    });

    // mock the response the first time
    vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(
      argyleFetchIdentityResponseTestyMcTesterson
    );

    // run the payload the first time with the first argyle_user
    await handleWebhook(payload);

    // e.g., wait three months and the user comes back to ff, signs up with a different phone number

    const secondUser = await createTestUserByPhone(SECOND_USER_PHONE);

    await updateProfileByUserId(supabase, secondUser.id, {
      argyle_user: 'ab9e092c-b568-b568-b568-ab9e092cb568'
    });

    // Here we want to change the response's phone to isolate the email conflict
    const secondFetchIdentityResponse = {
      ...argyleFetchIdentityResponseTestyMcTesterson,
      phone_number: '+10000000000',
      address: {
        city: 'Milwaukee',
        line1: '456 Oak Street',
        line2: 'Unit 12B',
        state: 'WI',
        country: 'US',
        postal_code: '90909'
      }
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

    // confirm that both profiles exist
    const { data: firstCountData, error: firstCountError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', [firstUser.id, secondUser.id]);

    if (firstCountError) throw firstCountError;
    expect(firstCountData.length).toBe(2);

    await handleWebhook(secondPayload);

    // now we expect both profiles to continue to exist
    const { data: secondCountData, error: secondCountError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', [firstUser.id, secondUser.id]);

    if (secondCountError) throw secondCountError;
    expect(secondCountData?.length).toBe(2);

    // find each user's profile by id
    const firstUserProfile = secondCountData.find((profile) => profile.user_id === firstUser.id);

    const secondUserProfile = secondCountData.find((profile) => profile.user_id === secondUser.id);

    if (!firstUserProfile || !secondUserProfile) {
      throw new Error('Profiles not found');
    }

    console.log('firstUserProfile', firstUserProfile);
    console.log('secondUserProfile', secondUserProfile);

    // confirm that the first user's phone number has *not* updated
    expect(firstUserProfile.phone).toBe(FIRST_USER_PHONE);

    // confirm that the first user's email has *not* updated
    expect(firstUserProfile.email).toBe(null);

    // confirm that the first user's address *has* updated
    expect(firstUserProfile.address).toBe('90001');

    // confirm that the second user's phone number has *not* updated
    expect(secondUserProfile?.phone).toBe(SECOND_USER_PHONE);

    // confirm that the second user's email has *not* updated
    expect(secondUserProfile.email).toBe(null);

    // confirm that the second user's address *has* been updated
    expect(secondUserProfile.address).toBe('90909');

    // confirm that there are two argyle_accounts records with different argyle_users
    const { data: argyleAccountsData, error: argyleAccountsError } = await supabase
      .from('argyle_accounts')
      .select('*')
      .in('user_id', [firstUser.id, secondUser.id]);

    if (argyleAccountsError) throw argyleAccountsError;
    expect(argyleAccountsData?.length).toBe(2);

    // expect the argyle_account values to be the same
    expect(argyleAccountsData[0].argyle_account).toBe(argyleAccountsData[1].argyle_account);

    // teardown both users
    await teardownTestUserByUserId(firstUser.id);
    await teardownTestUserByUserId(secondUser.id);
  });
});
