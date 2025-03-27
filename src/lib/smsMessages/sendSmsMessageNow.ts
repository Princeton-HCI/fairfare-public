import { attemptSendingSmsMessage, writeSmsMessageToDatabase } from './utils';

type SmsMessage = SupabaseRows['sms_messages'];

interface sendSmsMessageNowArguments {
  messageTemplateKey: string;
  messageArguments: { [key: string]: string };
  phoneNumber: string;
  lang?: string;
}

/**
 * Sends a message immediately.
 *
 * @param args: sendSmsMessageNowArguments
 * @param args.messageTemplateKey: string - The type of message to send. This maps to a message template.
 * @param args.messageArguments: { [key: string]: string } - The arguments to pass to the message template (determined by the message_template_key).
 * @param args.phoneNumber: string - The phone number to send the message to.
 * @param args.lang: string | null - The language to send the message in, like 'en'.
 * @returns SmsMessage
 */
const sendSmsMessageNow = async (args: sendSmsMessageNowArguments): Promise<SmsMessage> => {
  const writeSmsMessageToDatabaseArgs = {
    ...args,
    sendDelay: 0 // send now
  };
  const message = await writeSmsMessageToDatabase(writeSmsMessageToDatabaseArgs);
  console.log('Wrote sms message to db:', message.message, 'to', message.phone_number);

  return await attemptSendingSmsMessage(message);
};

export default sendSmsMessageNow;
