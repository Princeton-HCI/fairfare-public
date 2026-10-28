import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail,
  uniqueTestPhone
} from '@tests/utils/testUser';
import { supabase } from '@src/lib/server/db';
import * as sendSmsMessageNow from './sendSmsMessageNow';
import sendSmsMessageToUserNow from './sendSmsMessageToUserNow';
import { updateProfileByUserId } from '../databaseHelpers';
import { smsClient } from './sms.client';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';

type SmsMessage = SupabaseRows['sms_messages'];

describe('sendSmsMessageToUserNow', () => {
  const USER_PHONE = uniqueTestPhone();

  afterAll(async () => {
    const { error } = await supabase.from('sms_messages').delete().eq('phone_number', USER_PHONE);
    if (error) throw error;
  });

  it("calls sendSmsMessageNow with the user's phone number and language", async () => {
    const messageTemplateKey = 'welcome';
    const messageArguments = { name: 'John' };

    const user = await createTestUserByEmail(uniqueTestEmail('callssendsmsmessagenowcorrect'));
    await updateProfileByUserId(supabase, user.id, {
      phone: USER_PHONE,
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
      phoneNumber: USER_PHONE
    });

    await teardownTestUserByUserId(user.id);
  });
});

// Test Case Here
describe('sendSmsMessageNow with blacklisted phone number', () => {
  // Fixed, because it has to be a number the blacklist actually contains.
  const blacklistedNumber = '18009000010'; // first blacklisted number from util file

  // (phone_number, message_template_id) is unique, so the `skipped` row this
  // test writes would collide with itself on the next run of the suite.
  const clearMessages = async () => {
    const { error } = await supabase
      .from('sms_messages')
      .delete()
      .eq('phone_number', blacklistedNumber);
    if (error) throw error;
  };

  beforeAll(clearMessages);
  afterAll(clearMessages);

  it('updates the message status and does not call Twilio', async () => {
    const messageTemplateKey = 'welcome';
    const messageArguments = { name: 'Mani Test' };

    const twilioCreateSpy = vi.spyOn(smsClient.messages, 'create').mockImplementation(() =>
      Promise.resolve({
        sid: 'mock-sid',
        status: 'mock-status'
      } as unknown as MessageInstance)
    );

    // Call the blacklisted number
    const result = await sendSmsMessageNow.default({
      messageTemplateKey,
      messageArguments,
      phoneNumber: blacklistedNumber,
      lang: 'en'
    });

    // Verify Twilio and expected status
    expect(twilioCreateSpy).not.toHaveBeenCalled();
    expect(result.status).toBe('skipped');
    expect(result.error).toContain('blacklisted');

    // Make sure test case is removed
    twilioCreateSpy.mockRestore();
  });
});
