import { supabase } from '@lib/server/db';

import sendSmsMessageNow from './sendSmsMessageNow';

/**
 * Sends a message immediately to a given user.
 *
 * @param userId: string - The type of message to send. This maps to a message template.
 * @param messageTemplateKey: string - The type of message to send. This maps to a message template.
 * @param messageArguments: { [key: string]: string } - The arguments to pass to the message template (determined by the message_template_key).
 * @returns SmsMessage
 */
const sendSmsMessageToUserNow = async (
  userId: string,
  messageTemplateKey: string,
  messageArguments: { [key: string]: string }
): Promise<void> => {
  // if not userId of type string, throw error
  if (typeof userId !== 'string') throw new Error('userId must be a string');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;

  const phoneNumber = data?.phone;
  if (!phoneNumber) throw new Error('No phone number found for user');

  const lang = data?.preferred_language || undefined;

  await sendSmsMessageNow({
    messageTemplateKey,
    messageArguments,
    phoneNumber,
    lang
  });
};

export default sendSmsMessageToUserNow;
