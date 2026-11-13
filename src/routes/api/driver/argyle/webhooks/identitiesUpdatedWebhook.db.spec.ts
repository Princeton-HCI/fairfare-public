import { randomUUID } from 'crypto';
import { handleWebhook } from './handleWebhook';
import type { ArgyleWebhookResponse } from './types';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail,
  uniqueTestPhone
} from '@tests/utils/testUser';
import { supabase } from '@src/lib/server/db';

import * as argyle from '@src/lib/server/argyle';
import * as sendSmsMessageToUserNow from '@src/lib/smsMessages/sendSmsMessageToUserNow';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';
/**
 * Argyle identifiers unique to this run, so this file can run at the same time
 * as the other specs that used to share these literals (they collide on
 * argyle_user_unique and argyle_account when two files insert at once).
 */
const TEST_ARGYLE_USER = randomUUID();
const TEST_ARGYLE_IDENTITY = randomUUID();

describe('incoming identities.updated webhook', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'identities.updated',
    name: 'ALL_development',
    data: {
      account: '44444444-4444-4444-4444-444444444444',
      user: TEST_ARGYLE_USER,
      identity: TEST_ARGYLE_IDENTITY
    }
  };

  const argyleFetchIdentityResponse = {
    id: TEST_ARGYLE_IDENTITY,
    account: '44444444-4444-4444-4444-444444444444',
    address: {
      city: 'New York',
      line1: '123 Main',
      line2: null,
      state: 'NY',
      country: 'US',
      postal_code: '10014'
    },
    first_name: 'Bob',
    last_name: 'Jones',
    full_name: 'Bob Jones',
    birth_date: '1980-10-10',
    email: 'test1@argyle.com',
    phone_number: '+15555555555',
    picture_url: 'https://crouton.net/crouton.png',
    employment_status: 'inactive',
    employment_type: 'contractor',
    job_title: null,
    ssn: '522-09-1191',
    marital_status: 'Married filing jointly',
    gender: 'Male',
    hire_date: '2021-05-05',
    termination_date: '2023-09-18',
    termination_reason: null,
    employer: 'Uber',
    base_pay: { amount: null, period: null, currency: 'USD' },
    pay_cycle: 'weekly',
    platform_ids: {
      employee_id: null,
      position_id: null,
      platform_user_id: 'PLATFROM_USER_ID'
    },
    created_at: '2023-11-05T19:58:21.920Z',
    updated_at: '2023-11-05T20:01:07.480Z',
    metadata: {}
  };

  describe('when a new user number is updated', () => {
    it('does not update the number and calls addIdentityDataToUserAndEnableOtpLoginSpy', async () => {
      const user = await createTestUserByEmail(
        uniqueTestEmail('identitiesupdatedtextsnewnumberonupdate')
      );
      const signupPhone = uniqueTestPhone(); // the number the user signed up with

      await updateProfileByUserId(supabase, user.id, {
        argyle_user: TEST_ARGYLE_USER,
        phone: signupPhone
      });

      vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(argyleFetchIdentityResponse);

      // spy on addIdentityDataToUserAndEnableOtpLogin from argyle
      const addIdentityDataToUserAndEnableOtpLoginSpy = vi.spyOn(
        argyle,
        'addIdentityDataToUserAndEnableOtpLogin'
      );

      await handleWebhook(payload);

      // get the user's profile
      const { data: profile, error: supabaseFindUserError } = await supabase
        .from('profiles')
        .select('*')
        .eq('argyle_user', TEST_ARGYLE_USER)
        .single();
      if (supabaseFindUserError) throw supabaseFindUserError;

      // confirm that the phone number did not change
      expect(profile?.phone).toBe(signupPhone);

      await teardownTestUserByUserId(user.id);

      expect(addIdentityDataToUserAndEnableOtpLoginSpy).toHaveBeenCalledOnce();
      expect(addIdentityDataToUserAndEnableOtpLoginSpy).toHaveBeenCalledWith(
        TEST_ARGYLE_USER,
        argyleFetchIdentityResponse,
        { organizationId: null }
      );
    });
  });
  describe('when a user number is updated but the number stays the same', () => {
    it('does not text a user if their number stays the same', async () => {
      // set up
      const user = await createTestUserByEmail(
        uniqueTestEmail('identitiesupdateddoesnottextunchangednumber')
      );

      const signupPhone = uniqueTestPhone();

      // set the argyle_user value and the phone number
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: TEST_ARGYLE_USER,
        phone: signupPhone
      });
      vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(argyleFetchIdentityResponse);

      // spy on addIdentityDataToUserAndEnableOtpLogin from argyle
      const addIdentityDataToUserAndEnableOtpLoginSpy = vi
        .spyOn(argyle, 'addIdentityDataToUserAndEnableOtpLogin')
        .mockResolvedValueOnce({
          phone: signupPhone
        } as Profile);

      const sendSmsMessageToUserNowSpy = vi
        .spyOn(sendSmsMessageToUserNow, 'default')
        .mockResolvedValueOnce();

      // execute
      await handleWebhook(payload);

      // verify + cleanup
      await teardownTestUserByUserId(user.id);

      expect(addIdentityDataToUserAndEnableOtpLoginSpy).toHaveBeenCalledOnce();
      expect(addIdentityDataToUserAndEnableOtpLoginSpy).toHaveBeenCalledWith(
        TEST_ARGYLE_USER,
        argyleFetchIdentityResponse,
        { organizationId: null }
      );

      expect(sendSmsMessageToUserNowSpy).toHaveBeenCalledTimes(0);
    });
  });
});
