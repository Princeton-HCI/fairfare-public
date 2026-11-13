import { smsClient } from '@src/lib/smsMessages/sms.client';

import { GET } from './+server';
import { supabase } from '@src/lib/server/db';
import * as smsMessageUtils from '@src/lib/smsMessages/utils';
import { createInternalRequestEvent, createRequestEvent } from '@tests/utils/requestEvent';
import { uniqueTestPhone } from '@tests/utils/testUser';
import { scopeDatabaseReads } from '@tests/utils/scopeDatabaseReads';

type SmsMessageInsert = SupabaseInserts['sms_messages'];

const ENDPOINT = 'http://localhost/api/send_pending_sms_messages';

/**
 * Every row this file writes carries its own phone number, and every query and
 * cleanup is filtered on it. The file used to delete the whole `sms_messages`
 * table before and after each test and assert on global row counts, which meant
 * it destroyed — and was destroyed by — any other spec touching that table.
 */
const TEST_PHONE = uniqueTestPhone();

/** Messages are scheduled relative to the (possibly mocked) clock of the test. */
const pendingMessage = (overrides: Partial<SmsMessageInsert> = {}): SmsMessageInsert => ({
  phone_number: TEST_PHONE,
  message: 'test welcome message template',
  message_template_key: 'testkey',
  scheduled_to_send_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  ...overrides
});

const ourMessages = () => supabase.from('sms_messages').select('*').eq('phone_number', TEST_PHONE);

const deleteOurMessages = async () => {
  const { error } = await supabase.from('sms_messages').delete().eq('phone_number', TEST_PHONE);
  if (error) throw error;
};

/**
 * 1pm at UTC-6, inside the hours the endpoint is allowed to send in;
 * 3am at UTC-6, outside them.
 */
const INSIDE_SEND_HOURS_UTC = 19;
const OUTSIDE_SEND_HOURS_UTC = 9;

const setClockTo = (utcHour: number) => {
  const mockDate = new Date();
  mockDate.setUTCHours(utcHour, 0, 0, 0);
  vi.setSystemTime(mockDate);
};

describe('GET /api/send_pending_sms_messages', () => {
  const sends: ReturnType<typeof smsMessageUtils.attemptSendingSmsMessage>[] = [];
  const send = smsMessageUtils.attemptSendingSmsMessage;
  beforeEach(async () => {
    scopeDatabaseReads('sms_messages', 'phone_number', TEST_PHONE);
    await deleteOurMessages();
    vi.spyOn(smsMessageUtils, 'attemptSendingSmsMessage').mockImplementation((message) => {
      const result = send(message);
      sends.push(result);
      // The endpoint does not await sends. Observe rejection immediately;
      // Promise.all below still propagates it to the test.
      void result.catch(() => {});
      return result;
    });
  });

  afterEach(async () => {
    try {
      await Promise.all(sends.splice(0));
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
      await deleteOurMessages();
    }
  });

  describe('authentication', () => {
    it('should return 401 when Authorization header is missing', async () => {
      await expect(GET(createRequestEvent(ENDPOINT))).rejects.toMatchObject({
        status: 401
      });
    });

    it('should return 401 when Authorization header is invalid', async () => {
      const event = createRequestEvent(ENDPOINT, {
        headers: { Authorization: 'Bearer invalid-secret' }
      });

      await expect(GET(event)).rejects.toMatchObject({ status: 401 });
    });
  });

  it('should return success for no messages to send', async () => {
    const response = await GET(createInternalRequestEvent(ENDPOINT));
    const data = await response.json();

    expect(data).toEqual({ success: true });
  });

  it('sends a pending message', async () => {
    setClockTo(INSIDE_SEND_HOURS_UTC);

    const message = pendingMessage();
    const { error: insertError } = await supabase.from('sms_messages').insert(message);
    if (insertError) throw insertError;

    const attemptSendingSmsMessageSpy = vi.spyOn(smsMessageUtils, 'attemptSendingSmsMessage');

    const response = await GET(createInternalRequestEvent(ENDPOINT));
    expect(await response.json()).toEqual({ success: true });

    expect(attemptSendingSmsMessageSpy).toHaveBeenCalledTimes(1);
    expect(attemptSendingSmsMessageSpy).toHaveBeenCalledWith({
      phone_number: message.phone_number,
      message: message.message,
      id: expect.any(String),
      scheduled_to_send_at: expect.any(String)
    });

    await Promise.all(sends);
    const { data: stored, error } = await ourMessages();
    expect(error).toBeNull();
    expect(stored).toHaveLength(1);
    expect(stored![0].status).toBe('sent');
  });

  it('should prevent inserting two messages for the same phone number, message, and send time', async () => {
    const message = pendingMessage();
    const { error: firstInsertError } = await supabase.from('sms_messages').insert(message);
    expect(firstInsertError).toBeNull();

    // insert the same message again
    const { data, error } = await supabase.from('sms_messages').insert(message);
    expect(error?.message).toEqual(
      'duplicate key value violates unique constraint "unique_phone_number_message_scheduled_to_send_at"'
    );
    expect(data).toBeNull();

    const { data: stored } = await ourMessages();
    expect(stored).toHaveLength(1);
  });

  it('should prevent inserting two messages of the same type for the same phone number', async () => {
    const message = pendingMessage();
    const { error: firstInsertError } = await supabase.from('sms_messages').insert(message);
    expect(firstInsertError).toBeNull();

    const messageToBeSendInOneMinute = pendingMessage({
      scheduled_to_send_at: new Date(Date.now() + 60 * 1000).toISOString(),
      message: 'slightly different message'
    });

    // same phone number and message_template_key
    const { data, error } = await supabase.from('sms_messages').insert(messageToBeSendInOneMinute);
    expect(error?.message).toEqual(
      'duplicate key value violates unique constraint "unique_phone_number_message_template_id"'
    );
    expect(data).toBeNull();

    const { data: stored } = await ourMessages();
    expect(stored).toHaveLength(1);
  });

  describe('outside of the allowable send hours', () => {
    it('should not send any messages even when some are pending', async () => {
      setClockTo(OUTSIDE_SEND_HOURS_UTC);

      const { error: insertError } = await supabase
        .from('sms_messages')
        .insert([
          pendingMessage({ message_template_key: 'testkey' }),
          pendingMessage({ message_template_key: 'testkey2', message: 'Hello world 2!' }),
          pendingMessage({ message_template_key: 'testkey3', message: 'Hello world 3!' })
        ]);
      if (insertError) throw insertError;

      const twilioMessagesCreateSpy = vi.spyOn(smsClient.messages, 'create');

      await GET(createInternalRequestEvent(ENDPOINT));

      expect(twilioMessagesCreateSpy).toHaveBeenCalledTimes(0);

      const { data: stored } = await ourMessages();
      expect(stored?.every((row) => row.status !== 'sent')).toBe(true);
    });
  });

  describe('inside of the allowable send hours', () => {
    it('sends pending messages', async () => {
      setClockTo(INSIDE_SEND_HOURS_UTC);

      const messages = [
        pendingMessage({ message_template_key: 'testkey' }),
        pendingMessage({ message_template_key: 'testkey2', message: 'Hello world 2!' }),
        pendingMessage({ message_template_key: 'testkey3', message: 'Hello world 3!' })
      ];
      const { error: insertError } = await supabase.from('sms_messages').insert(messages);
      if (insertError) throw insertError;

      const attemptSendingSmsMessageSpy = vi.spyOn(smsMessageUtils, 'attemptSendingSmsMessage');

      await GET(createInternalRequestEvent(ENDPOINT));

      expect(attemptSendingSmsMessageSpy).toHaveBeenCalledTimes(messages.length);
      for (const message of messages) {
        expect(attemptSendingSmsMessageSpy).toHaveBeenCalledWith({
          phone_number: message.phone_number,
          message: message.message,
          id: expect.any(String),
          scheduled_to_send_at: expect.any(String)
        });
      }
      await Promise.all(sends);
      const { data: stored, error } = await ourMessages();
      expect(error).toBeNull();
      expect(stored).toHaveLength(messages.length);
      expect(stored!.every((row) => row.status === 'sent')).toBe(true);
    });
  });
});
