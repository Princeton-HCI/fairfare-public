import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import { supabase } from '@src/lib/server/db';
import * as sendSmsMessageNow from './sendSmsMessageNow';
import sendSmsMessageToUserNow from './sendSmsMessageToUserNow';
import { updateProfileByUserId } from '../databaseHelpers';

type SmsMessage = SupabaseRows['sms_messages'];

describe('sendSmsMessageToUserNow', () => {
  it("calls sendSmsMessageNow with the user's phone number and language", async () => {
    const messageTemplateKey = 'welcome';
    const messageArguments = { name: 'John' };

    const user = await createTestUserByEmail('callsSendSmsMessageNowCorrect@test.test');
    await updateProfileByUserId(supabase, user.id, {
      phone: '12222222222',
      preferred_language: 'fr'
    });

    const sendSmsMessageNowSpy = vi
      .spyOn(sendSmsMessageNow, 'default')
      .mockResolvedValueOnce({ id: 'abc' } as SmsMessage);

    await sendSmsMessageToUserNow(user.id, messageTemplateKey, messageArguments);

    expect(sendSmsMessageNowSpy).toHaveBeenCalledWith({
      lang: 'fr',
      messageTemplateKey: 'welcome',
      messageArguments: { name: 'John' },
      phoneNumber: '12222222222'
    });

    await teardownTestUserByUserId(user.id);
  });
});
