import sendSmsMessageNow from './sendSmsMessageNow';
import { supabase } from '@src/lib/server/db';
import { smsClient } from './sms.client';
import { uniqueTestPhone } from '@tests/utils/testUser';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';

/**
 * Each test sends to a phone number of its own, so nothing here depends on
 * `sms_messages` being empty. The file used to delete every row in that table
 * before each test — which also deleted the messages other specs were asserting
 * on — and one test asserted the table was globally empty afterwards.
 */
describe('sendSmsMessageNow', () => {
  const phoneNumbers: string[] = [];

  // Twilio is stubbed at the client rather than over HTTP. Letting the Twilio
  // SDK make a real request for MSW to intercept turned out to fail
  // intermittently under parallel runs ("An invalid response was received from
  // the upstream server"), and nothing here is testing Twilio's transport —
  // these tests are about the database constraints around a send.
  beforeEach(() => {
    vi.spyOn(smsClient.messages, 'create').mockResolvedValue({
      sid: 'stub-sid',
      status: 'queued'
    } as unknown as MessageInstance);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const testPhoneNumber = () => {
    const phoneNumber = uniqueTestPhone();
    phoneNumbers.push(phoneNumber);
    return phoneNumber;
  };

  afterAll(async () => {
    if (phoneNumbers.length === 0) return;
    const { error } = await supabase.from('sms_messages').delete().in('phone_number', phoneNumbers);
    if (error) throw error;
  });

  it('does not allow multiple welcome messages', async () => {
    const messageTemplateKey = 'welcome';
    const phoneNumber = testPhoneNumber();

    await sendSmsMessageNow({
      messageTemplateKey,
      messageArguments: {},
      phoneNumber
    });

    // run again and expect an error
    await expect(
      sendSmsMessageNow({
        messageTemplateKey,
        messageArguments: {},
        phoneNumber
      })
    ).rejects.toThrowError(
      'duplicate key value violates unique constraint "unique_phone_number_message_template_id"'
    );
  });

  it('allow multiple account_already_exists messages', async () => {
    const messageTemplateKey = 'account_already_exists';
    const phoneNumber = testPhoneNumber();

    await sendSmsMessageNow({
      messageTemplateKey,
      messageArguments: {},
      phoneNumber
    });

    // run again and no error
    await sendSmsMessageNow({
      messageTemplateKey,
      messageArguments: {},
      phoneNumber,
      lang: 'fr' // lang doesn't matter here
    });

    // run again and no error for good measure
    await sendSmsMessageNow({
      messageTemplateKey,
      messageArguments: {},
      phoneNumber
    });
  });
});
