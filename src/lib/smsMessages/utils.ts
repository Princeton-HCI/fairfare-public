import { supabase } from '@src/lib/server/db';
import { VITE_TWILIO_NUMBER } from '$env/static/private';
import { smsClient } from './sms.client';

import enDict from '@src/lang/en.json';
import esDict from '@src/lang/es.json';
import frDict from '@src/lang/fr.json';

function messageArgumentsAreValid(
  messageTemplate: string,
  messageArguments: { [key: string]: string }
): boolean {
  /**
   * Finds the values between {{ and }} in the message template and checks
   * if they are all present in the message arguments.
   * @returns boolean - true if all expected arguments are present in messageArguments.
   */
  const expectedArguments = (messageTemplate.match(/{{\s*([^}\s]+)\s*}}/g) || []).map(
    (match) => match.slice(2, -2) // removes the {{ and }} from the match
  );
  // if there are no expected arguments, we return true
  if (expectedArguments.length === 0) return true;

  // check if there are any values in expectedArguments that are not in messageArguments
  for (const key of expectedArguments) {
    if (!messageArguments[key]) {
      // this key is missing from messageArguments, we return false
      return false;
    }
  }
  return true;
}

function formatMessage(template: string, args: { [key: string]: string }): string {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (match, group) => {
    const value = args[group.trim()];
    return value !== undefined ? value : match;
  });
}

type SmsMessageInsert = SupabaseInserts['sms_messages'];
type SmsMessage = SupabaseRows['sms_messages'];

export const fallbackLanguage = 'en';

const getLanguageDict = (lang: string) => {
  /**
   * Get the appropriate language dictionary for the sms messages.
   */
  if (lang == 'en') return enDict;
  if (lang == 'es') return esDict;
  if (lang == 'fr') return frDict;

  // if this is not supported, we'll return the english dictionary as a fallback
  return enDict;
};

interface baseSendSmsMessageArguments {
  messageTemplateKey: string;
  messageArguments: { [key: string]: string };
  phoneNumber: string;
  sendDelay: number;
  lang?: string;
}

/**
 * Writes message information to the database.
 * This has the effect of scheduling the message to be sent.
 *
 * @param args: baseSendSmsMessageArguments
 * @param args.messageTemplateKey: string - The type of message to send. This maps to a message template.
 * @param args.messageArguments: { [key: string]: string } - The arguments to pass to the message template (determined by the message_template_key).
 * @param args.phoneNumber: string - The phone number to send the message to.
 * @param args.sendDelay: number - The delay *in seconds* before the message is sent. For sending now, this is 0.
 * @param args.lang: string | null - The language to send the message in, like 'en'.
 * @returns SmsMessage
 */
const writeSmsMessageToDatabase = async (
  args: baseSendSmsMessageArguments
): Promise<SmsMessage> => {
  const { messageTemplateKey, messageArguments, phoneNumber, sendDelay, lang } = args;

  const languageCode = lang || fallbackLanguage;

  const languageDictLookup = `sms_message_template.${messageTemplateKey}`;

  const languageDict = getLanguageDict(languageCode);

  // @ts-expect-error -- we validate below that the messageTemplate is not undefined
  const messageTemplate = languageDict[languageDictLookup];

  if (!messageTemplate) {
    throw new Error('Message type not found.');
  }

  // Confirm that the message arguments are valid
  if (!messageArgumentsAreValid(messageTemplate, messageArguments)) {
    throw new Error(
      'Missing sms message arguments for messageTemplateKey "' +
        messageTemplateKey +
        '". Arguments: ' +
        JSON.stringify(messageArguments)
    );
  }

  // Format the message template with the message arguments.
  const formattedMessage: string = formatMessage(messageTemplate, messageArguments);

  // Write to the messages table, include send delay.

  const insertData: SmsMessageInsert = {
    message_template_key: messageTemplateKey,
    message: formattedMessage,
    phone_number: phoneNumber,
    scheduled_to_send_at: new Date(Date.now() + sendDelay * 1000).toISOString()
  };

  const { data, error } = await supabase.from('sms_messages').insert(insertData).select().single();

  if (error) {
    throw error;
  }

  return data;
};

type AttemptSendingSmsMessage = {
  id: string;
  phone_number: string;
  message: string;
};

const attemptSendingSmsMessage = async (message: AttemptSendingSmsMessage): Promise<SmsMessage> => {
  const client = smsClient;

  const sendMessage = ({ phone, body }: { phone: string; body: string }) => {
    const { MODE } = import.meta.env;
    if (MODE === 'test' || MODE === 'development') {
      console.log('[TEST / DEV MODE], mock sending "' + body + '" to', phone);
      return {};
    }
    return client.messages.create({
      body,
      from: VITE_TWILIO_NUMBER,
      to: phone
    });
  };

  try {
    // send the message
    await sendMessage({ phone: message.phone_number, body: message.message });

    // logging
    const { data: updateData, error: updateError } = await supabase
      .from('sms_messages')
      .update({ status: 'sent', sent_to_twilio_at: new Date().toISOString() })
      .match({ id: message.id })
      .select();
    if (updateError) console.error(updateError);
    if (updateError) throw updateError;
    if (updateData.length !== 1) throw Error('Failed to update the message status.');
    return updateData[0];
  } catch (error) {
    // TODO: test w broken number and confirm table is updated

    // logging
    const errorAsStr = error instanceof Error ? error?.message : JSON.stringify(error);
    await supabase
      .from('sms_messages')
      .update({ status: 'failed', sent_to_twilio_at: new Date().toISOString(), error: errorAsStr })
      .match({ id: message.id });
    throw Error('Sending SMS messages through Twilio failed. ' + errorAsStr);
  }
};

export { formatMessage, writeSmsMessageToDatabase, attemptSendingSmsMessage };
