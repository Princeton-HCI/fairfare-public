import sendSmsMessageNow from './sendSmsMessageNow';
import { supabase } from '@src/lib/server/db';

describe('sendSmsMessageNow', () => {
  it('does not allow multiple welcome messages', async () => {
    // clean up sms_messages
    await supabase.from('sms_messages').delete().neq('message', null);

    const messageTemplateKey = 'welcome';

    await sendSmsMessageNow({
      messageTemplateKey,
      messageArguments: {},
      phoneNumber: '18889992299'
    });

    // run again and expect an error
    await expect(
      sendSmsMessageNow({
        messageTemplateKey,
        messageArguments: {},
        phoneNumber: '18889992299'
      })
    ).rejects.toThrowError(
      'duplicate key value violates unique constraint "unique_phone_number_message_template_id"'
    );
  });

  it('allow multiple account_already_exists messages', async () => {
    // clean up sms_messages
    await supabase.from('sms_messages').delete().neq('message', null);

    const messageTemplateKey = 'account_already_exists';

    await sendSmsMessageNow({
      messageTemplateKey,
      messageArguments: {},
      phoneNumber: '18889992299'
    });

    // run again and no error
    await sendSmsMessageNow({
      messageTemplateKey,
      messageArguments: {},
      phoneNumber: '18889992299',
      lang: 'fr' // lang doesn't matter here
    });

    // run again and no error for good measure
    await sendSmsMessageNow({
      messageTemplateKey,
      messageArguments: {},
      phoneNumber: '18889992299'
    });
  });
});
