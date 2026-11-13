import short from 'short-uuid';
import { sendTakeRateMessageIfElegibleToArgyleUser } from './sendTakeRateMessageIfElegibleToArgyleUser';
import * as sendSmsMessageNow from '@src/lib/smsMessages/sendSmsMessageNow';

import { generateMockedDriverActivityRow } from '@tests/mocks/activities';

import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail,
  uniqueTestPhone
} from '@tests/utils/testUser';
import { supabase } from '@src/lib/server/db';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';

type SmsMessage = SupabaseRows['sms_messages'];

describe('sendTakeRateMessageIfElegibleToArgyleUser', () => {
  // Not the demo organizer's 12223334444: that number belongs to the Playwright
  // organizer fixtures, and a leftover row holding it fails this file's
  // createUser on users_phone_key.
  const USER_PHONE = uniqueTestPhone();

  describe('when the user has over ten activities and has not already completed the survey', () => {
    it('should send a survey to the user', async () => {
      // setup
      // give the user 11 activities

      // make the user
      const user = await createTestUserByEmail(
        uniqueTestEmail('sendsurveyifelegibleuseriselegible')
      );

      // and set the argyle user id + phone number
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43',
        phone: USER_PHONE
      });

      // create argyle account for the user
      const { data: argyleAccount, error: accountInsertError } = await supabase
        .from('argyle_accounts')
        .insert({
          user_id: user.id,
          argyle_account: '2b6b4b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b',
          argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43'
        })
        .select()
        .single();

      if (accountInsertError) throw accountInsertError;

      // add 22 activities to the user
      const activities = Array.from({ length: 22 }, () =>
        generateMockedDriverActivityRow({
          user: user.id,
          account_id: argyleAccount.id
        })
      );

      const { error: insertError } = await supabase
        .from('argyle_driver_activities')
        .insert(activities);

      if (insertError) {
        throw insertError;
      }

      // spy on sendSmsMessageNow
      const sendSmsMessageNowSpy = vi
        .spyOn(sendSmsMessageNow, 'default')
        .mockResolvedValueOnce({} as SmsMessage);

      // run
      await sendTakeRateMessageIfElegibleToArgyleUser('c697430e-5ae2-4464-baf8-216c238c8d43');

      // delete argyle_account
      await teardownTestUserByUserId(user.id);

      // make the short id
      const translator = short();
      const shortUserId = translator.fromUUID(user.id);

      // expect sendSmsMessageNow to have been called with args
      expect(sendSmsMessageNowSpy).toHaveBeenCalledWith({
        messageTemplateKey: 'view_take_rate',
        messageArguments: {
          // this is the short-code version of the user's user id
          driverDataLink: `https://www.getsystem.org/driver/data/${shortUserId}`
        },
        phoneNumber: USER_PHONE
      });

      expect(sendSmsMessageNowSpy).toHaveBeenCalledOnce();
    });
  });
  describe('when the user has no activities', () => {
    it('should *not* send a survey to the user', async () => {
      // setup

      // make the user
      const user = await createTestUserByEmail(
        uniqueTestEmail('sendsurveyifelegibleuserhasnoactivities')
      );

      // and set the argyle user id
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43',
        phone: '14445556666'
      });

      // spy on sendSmsMessageNow
      const sendSmsMessageNowSpy = vi
        .spyOn(sendSmsMessageNow, 'default')
        .mockResolvedValueOnce({} as SmsMessage);

      // run
      await sendTakeRateMessageIfElegibleToArgyleUser('c697430e-5ae2-4464-baf8-216c238c8d43');

      // verify
      await teardownTestUserByUserId(user.id);

      // expect sendSmsMessageNow to not have been called
      expect(sendSmsMessageNowSpy).not.toHaveBeenCalled();
    });
  });
  describe('when the user has 9 activities', () => {
    it('should *not* send a survey to the user', async () => {
      // setup

      // make the user
      const user = await createTestUserByEmail(
        uniqueTestEmail('sendsurveyifelegibleuserhasnineactivities')
      );

      // and set the argyle user id
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43',
        phone: USER_PHONE
      });

      // create argyle account for the user
      const { data: argyleAccount, error: accountInsertError } = await supabase
        .from('argyle_accounts')
        .insert({
          user_id: user.id,
          argyle_account: '2b6b4b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b',
          argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43'
        })
        .select()
        .single();

      if (accountInsertError) throw accountInsertError;

      // add 9 activities to the user
      const activities = Array.from({ length: 9 }, () =>
        generateMockedDriverActivityRow({
          user: user.id,
          account_id: argyleAccount.id
        })
      );
      await supabase.from('argyle_driver_activities').insert(activities);

      // spy on sendSmsMessageNow
      const sendSmsMessageNowSpy = vi
        .spyOn(sendSmsMessageNow, 'default')
        .mockResolvedValueOnce({} as SmsMessage);

      // run
      await sendTakeRateMessageIfElegibleToArgyleUser('c697430e-5ae2-4464-baf8-216c238c8d43');

      // verify
      await teardownTestUserByUserId(user.id);

      // expect sendSmsMessageNow to not have been called
      expect(sendSmsMessageNowSpy).not.toHaveBeenCalled();
    });
  });
  describe('when the user has already completed the survey and has over 10 activities', () => {
    it('should *not* send a survey to the user', async () => {
      // setup

      // make the user
      const user = await createTestUserByEmail(
        uniqueTestEmail('sendsurveyifelegibleuseriselegible')
      );

      // and set the argyle user id
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43',
        phone: '12223339999'
      });

      // create argyle account for the user
      const { data: argyleAccount, error: accountInsertError } = await supabase
        .from('argyle_accounts')
        .insert({
          user_id: user.id,
          argyle_account: '2b6b4b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b',
          argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43'
        })
        .select()
        .single();

      if (accountInsertError) throw accountInsertError;

      // add 22 activities to the user
      const activities = Array.from({ length: 22 }, () =>
        generateMockedDriverActivityRow({
          user: user.id,
          account_id: argyleAccount.id
        })
      );
      await supabase.from('argyle_driver_activities').insert(activities);

      // add a completed survey
      await supabase.from('survey_fair_take_rate').insert({
        user_id: user.id,
        estimate: 30
      });

      // spy on sendSmsMessageNow
      const sendSmsMessageNowSpy = vi
        .spyOn(sendSmsMessageNow, 'default')
        .mockResolvedValueOnce({} as SmsMessage);

      // run
      await sendTakeRateMessageIfElegibleToArgyleUser('c697430e-5ae2-4464-baf8-216c238c8d43');

      // verify

      // expect sendSmsMessageNow to not have been called
      expect(sendSmsMessageNowSpy).not.toHaveBeenCalled();

      // cleanup
      await teardownTestUserByUserId(user.id);
    });
  });
});
