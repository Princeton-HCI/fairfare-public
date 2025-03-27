import { handleWebhook } from './handleWebhook';
import type { ArgyleWebhookResponse } from './types';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import { supabase } from '@src/lib/server/db';

import * as argyle from '@src/lib/server/argyle';
import * as sendSmsMessageToUserNow from '@src/lib/smsMessages/sendSmsMessageToUserNow';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';

describe('incoming identities.updated webhook', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'identities.updated',
    name: 'ALL_development',
    data: {
      account: '44444444-4444-4444-4444-444444444444',
      user: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      identity: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    }
  };

  const argyleFetchIdentityResponse = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
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
    it('texts the user at the new number', async () => {
      const user = await createTestUserByEmail('identitiesUpdatedTextsNewNumberOnUpdate@test.test');

      await updateProfileByUserId(supabase, user.id, {
        argyle_user: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        phone: '18009000100' // pretend we have the user and this is their previous phone
      });

      vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(argyleFetchIdentityResponse);

      // spy on addIdentityDataToUserAndEnableOtpLogin from argyle
      const addIdentityDataToUserAndEnableOtpLoginSpy = vi.spyOn(
        argyle,
        'addIdentityDataToUserAndEnableOtpLogin'
      );

      // we want to send the sms here too—their phone number changed
      const sendSmsMessageToUserNowSpy = vi
        .spyOn(sendSmsMessageToUserNow, 'default')
        .mockResolvedValueOnce();

      // overwrite data.user in the payload
      await handleWebhook(payload);

      await teardownTestUserByUserId(user.id);

      expect(addIdentityDataToUserAndEnableOtpLoginSpy).toHaveBeenCalledOnce();
      expect(addIdentityDataToUserAndEnableOtpLoginSpy).toHaveBeenCalledWith(
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        argyleFetchIdentityResponse
      );

      expect(sendSmsMessageToUserNowSpy).toHaveBeenCalledTimes(1);
      expect(sendSmsMessageToUserNowSpy).toHaveBeenCalledWith(user.id, 'welcome', {});
    });
  });
  describe('when a user number is updated but the number stays the same', () => {
    it('does not text a user if their number stays the same', async () => {
      // set up
      const user = await createTestUserByEmail(
        'identitiesUpdatedDoesNotTextUnchangedNumber@test.test'
      );

      // set the argyle_user value and the phone number
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        phone: '12222022002'
      });
      vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(argyleFetchIdentityResponse);

      // spy on addIdentityDataToUserAndEnableOtpLogin from argyle
      const addIdentityDataToUserAndEnableOtpLoginSpy = vi
        .spyOn(argyle, 'addIdentityDataToUserAndEnableOtpLogin')
        .mockResolvedValueOnce({
          phone: '12222022002'
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
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        argyleFetchIdentityResponse
      );

      expect(sendSmsMessageToUserNowSpy).toHaveBeenCalledTimes(0);
    });
  });
});
