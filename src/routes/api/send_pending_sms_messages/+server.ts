import { supabase } from '@src/lib/server/db';
import { error, json } from '@sveltejs/kit';
import { attemptSendingSmsMessage } from '@src/lib/smsMessages/utils';

export const GET = async () => {
  const minimumAllowableSendHours = 10; // 10am
  const maximumAllowableSendHours = 16; // 4pm

  const { data, error: supabaseError } = await supabase
    .from('sms_messages')
    .select('*')
    // scheduled to be sent
    .lte('scheduled_to_send_at', new Date().toISOString())
    // not yet tried to send
    .is('sent_to_twilio_at', null)
    // not yet sent
    .eq('status', 'pending')
    .select('phone_number, message, id, scheduled_to_send_at');

  if (supabaseError) {
    console.log('send_pending_sms_messages: error selecting pending messages', supabaseError);
    throw error(500, 'Selecting pending messages failed.');
  }

  // get current time in hours in UTC-6
  const currentTimeInCentralTimeInHours = new Date().getUTCHours() - 6;

  if (data === null || data.length === 0) {
    console.log('send_pending_sms_messages: no pending messages');
    return json({ success: true });
  }

  // compare currentTimeInCentralTimeInHours to the minimum and maximum allowable send hours
  // if it's outside of that range, return early
  if (
    currentTimeInCentralTimeInHours < minimumAllowableSendHours ||
    currentTimeInCentralTimeInHours > maximumAllowableSendHours
  ) {
    console.log('send_pending_sms_messages: current time outside of allowable hours');
    return json({ success: true });
  }

  console.log(`send_pending_sms_messages: attempting to send ${data.length} pending messages`);
  data.forEach(async (message) => {
    attemptSendingSmsMessage(message);
  });

  return json({ success: true });
};
