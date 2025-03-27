import { smsClient } from '@src/lib/smsMessages/sms.client';

import { GET } from './+server';
import { supabase } from '@src/lib/server/db';
import * as smsMessageUtils from '@src/lib/smsMessages/utils';

type SmsMessageInsert = SupabaseInserts['sms_messages'];

describe('GET /api/send_pending_sms_pessages', () => {
  const messageToBeSentNow: SmsMessageInsert = {
    phone_number: '13337773333',
    message: 'test welcome message template',
    message_template_key: 'testkey',
    scheduled_to_send_at: new Date(Date.now()).toISOString()
  };

  beforeEach(async () => {
    // delete all the sms_messages in the table
    await supabase.from('sms_messages').delete().neq('message', null);
  });

  afterEach(async () => {
    // delete all the sms_messages in the table
    await supabase.from('sms_messages').delete().neq('message', null);
  });

  const threePendingMessages: SmsMessageInsert[] = [
    {
      phone_number: '13337773333',
      message: 'Hello world!',
      message_template_key: 'testkey',
      scheduled_to_send_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString()
    },
    {
      phone_number: '13337773333',
      message: 'Hello world!',
      message_template_key: 'testkey2',
      scheduled_to_send_at: new Date(Date.now() - 45 * 60 * 60 * 1000).toISOString()
    },
    {
      phone_number: '13337773333',
      message: 'Hello world!',
      message_template_key: 'testkey3',
      scheduled_to_send_at: new Date(Date.now() - 60 * 60 * 60 * 1000).toISOString()
    }
  ];

  it('should return success for no messages to send', async () => {
    // delete all sms_messages in the table
    await supabase.from('sms_messages').delete().neq('message', null);

    // call the endpoint from the file
    const response = await GET();
    const data = await response.json();

    // expect the response to be success: true
    expect(data).toEqual({ success: true });
  });

  // FIXME: stop skipping!
  it.skip('should return success for one message to send', async () => {
    // delete all the sms_messages in the table
    const { error: deleteError } = await supabase
      .from('sms_messages')
      .delete()
      .neq('message', null);
    if (deleteError) throw deleteError;

    // insert one message
    const { error: insertError } = await supabase.from('sms_messages').insert(messageToBeSentNow);
    if (insertError) throw insertError;

    // spy on attemptSendingSmsMessage
    const attemptSendingSmsMessageSpy = vi.spyOn(smsMessageUtils, 'attemptSendingSmsMessage');

    // call the endpoint from the file
    const response = await GET();
    const data = await response.json();

    // expect the response to be success: true
    expect(data).toEqual({ success: true });

    // expect attemptSendingSmsMessage to have been called once
    expect(attemptSendingSmsMessageSpy).toHaveBeenCalledTimes(1);
    expect(attemptSendingSmsMessageSpy).toHaveBeenCalledWith({
      phone_number: messageToBeSentNow.phone_number,
      message: messageToBeSentNow.message,
      id: expect.any(String),
      scheduled_to_send_at: expect.any(String)
    });

    // expect the message to have been sent in supabase
    const { data: updatedMessage, error: smsMessageCheckError } = await supabase
      .from('sms_messages')
      .select('*');
    if (smsMessageCheckError) throw smsMessageCheckError;
    expect(updatedMessage.length).toBe(1);
    expect(updatedMessage[0].status).toBe('sent');

    // delete all the sms_messages in the table
    const { error: cleanupError } = await supabase
      .from('sms_messages')
      .delete()
      .neq('message', null);
    if (cleanupError) throw cleanupError;
  });

  it('should prevent inserting two messages for the same phone number, message, and send time', async () => {
    expect((await supabase.from('sms_messages').select('*', { count: 'exact' })).count).toBe(0);

    // insert one message
    await supabase.from('sms_messages').insert(messageToBeSentNow);

    // insert the same message again
    const { data, error } = await supabase.from('sms_messages').insert(messageToBeSentNow);
    expect(error?.message).toEqual(
      'duplicate key value violates unique constraint "unique_phone_number_message_scheduled_to_send_at"'
    );
    expect(data).toBeNull();

    // expect only one message to be in the table
    expect((await supabase.from('sms_messages').select('*')).data?.length).toBe(1);

    // delete all the sms_messages in the table
    await supabase.from('sms_messages').delete().neq('message', null);

    // expect table to be empty
    expect((await supabase.from('sms_messages').select('*', { count: 'exact' })).count).toBe(0);
  });

  it('should prevent inserting two messages of the same type for the same phone number', async () => {
    // insert one message
    await supabase.from('sms_messages').insert(messageToBeSentNow);

    const messageToBeSendInOneMinute: SmsMessageInsert = {
      ...messageToBeSentNow,
      scheduled_to_send_at: new Date(Date.now() + 60 * 1000).toISOString(),
      message: 'slightly different message'
    };

    // insert the message with the same phone number and message_template_key
    const { data, error } = await supabase.from('sms_messages').insert(messageToBeSendInOneMinute);
    expect(error?.message).toEqual(
      'duplicate key value violates unique constraint "unique_phone_number_message_template_id"'
    );
    expect(data).toBeNull();

    // get all sms_messages
    const { data: allMessages } = await supabase.from('sms_messages').select('*');

    // expect only one message to be in the table
    expect(allMessages?.length).toEqual(1);
  });

  describe('when outside of the allowable send hours', () => {
    beforeEach(() => {
      // mock the time
      const mockDate = new Date();
      // we use UTC-6
      // 3am at UTC-6 is 9am UTC
      mockDate.setUTCHours(9);
      // use the mock date
      vi.setSystemTime(mockDate);
    });

    it('should not send any messages even when some are pending', async () => {
      // insert three pending messages
      const { error: insertError } = await supabase
        .from('sms_messages')
        .insert(threePendingMessages);

      if (insertError) throw insertError;
      expect(insertError).toBeNull();

      const { data: allMessages, error: selectError } = await supabase
        .from('sms_messages')
        .select('*');
      if (selectError) throw selectError;
      expect(selectError).toBeNull();

      // there should be three messages in the table
      expect(allMessages?.length).toEqual(3);

      const twilioMessagesCreateSpy = vi.spyOn(smsClient.messages, 'create');

      // call the endpoint
      await GET();

      // expect twilio.messages.create to have been called **ZERO** times
      expect(twilioMessagesCreateSpy).toHaveBeenCalledTimes(0);
    });

    afterEach(() => {
      vi.resetAllMocks(); // restore the system time
    });
  });

  describe('when inside of the allowable send hours', () => {
    beforeEach(() => {
      // mock the time
      const mockDate = new Date();
      // we use UTC-6
      // 1pm (13:00) at UTC-6 is 7pm (19:00) UTC
      mockDate.setUTCHours(19);
      // use the mock date
      vi.setSystemTime(mockDate);
    });

    // FIXME: stop skipping!
    it.skip('sends pending messages', async () => {
      // insert three pending messages
      const { error: insertError } = await supabase
        .from('sms_messages')
        .insert(threePendingMessages);
      expect(insertError).toBeNull();

      const { data: allMessages, error: selectError } = await supabase
        .from('sms_messages')
        .select('*');
      expect(selectError).toBeNull();

      // there should be three messages in the table
      expect(allMessages?.length).toEqual(3);

      const twilioMessagesCreateSpy = vi.spyOn(smsClient.messages, 'create');

      // call the endpoint
      await GET();

      // expect twilio.messages.create to have been called 3 times
      expect(twilioMessagesCreateSpy).toHaveBeenCalledTimes(3);
    });

    afterEach(() => {
      // restore the system time
      vi.resetAllMocks();
    });
  });
});
