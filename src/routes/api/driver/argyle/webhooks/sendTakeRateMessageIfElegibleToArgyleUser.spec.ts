import short from 'short-uuid';
import { sendTakeRateMessageIfElegibleToArgyleUser } from './sendTakeRateMessageIfElegibleToArgyleUser';
import * as sendSmsMessageNow from '@src/lib/smsMessages/sendSmsMessageNow';

import { generateMockedDriverActivity } from '@src/mocks/activities';

import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import { supabase } from '@src/lib/server/db';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';

type SmsMessage = SupabaseRows['sms_messages'];

describe('sendTakeRateMessageIfElegibleToArgyleUser', () => {
  describe('when the user has over ten activities and has not already completed the survey', () => {
    it('should send a survey to the user', async () => {
      // setup
      // give the user 11 activities

      // make the user
      const user = await createTestUserByEmail('sendsurveyifelegibleuseriselegible@test.test');

      // and set the argyle user id + phone number
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43',
        phone: '12223334444'
      });

      // create argyle account for the user
      await supabase.from('argyle_accounts').insert({
        user_id: user.id,
        argyle_account: '2b6b4b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b',
        argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43'
      });

      // add 22 activities to the user
      const activities = Array.from({ length: 22 }, () =>
        generateMockedDriverActivity({
          user: user.id,
          account: '2b6b4b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
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
        phoneNumber: '12223334444'
      });

      expect(sendSmsMessageNowSpy).toHaveBeenCalledOnce();
    });
  });
  describe('when the user has no activities', () => {
    it('should *not* send a survey to the user', async () => {
      // setup

      // make the user
      const user = await createTestUserByEmail('sendSurveyIfElegibleUserHasNoActivities@test.test');

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
        'sendSurveyIfElegibleUserHasNineActivities@test.test'
      );

      // and set the argyle user id
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43',
        phone: '12223334444'
      });

      // add 9 activities to the user
      const activities = Array.from({ length: 9 }, () =>
        generateMockedDriverActivity({ user: user.id })
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
      const user = await createTestUserByEmail('sendSurveyIfElegibleUserIsElegible@test.test');

      // and set the argyle user id
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: 'c697430e-5ae2-4464-baf8-216c238c8d43',
        phone: '12223339999'
      });

      // add 22 activities to the user
      const activities = Array.from({ length: 22 }, () =>
        generateMockedDriverActivity({ user: user.id })
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
