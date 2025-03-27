import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import sendSmsMessageNow from '@src/lib/smsMessages/sendSmsMessageNow';
import * as getDriverDataLinkFromArgyleUserId from '@src/routes/api/driver/argyle/webhooks/sendTakeRateMessageIfElegibleToArgyleUser';
import * as utils from './utils';

import { vi, describe, it, expect } from 'vitest';

import type { Mock } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

type MockRequestEvent = RequestEvent<Record<string, string>, '/api/driver/send-demo-sms'>;

vi.mock('@src/lib/smsMessages/sendSmsMessageNow', () => ({
  default: vi.fn()
}));

vi.mock('@src/lib/server/db', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn()
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn()
  }
}));

describe('POST /api/driver/send-demo-sms', () => {
  // Here we'll bump the timeout since there's a 6s delay between sending SMS messages
  it('sends two SMS messages successfully with correct parameters', { timeout: 9000 }, async () => {
    // Mock signInWithOtp
    (supabase.auth.signInWithOtp as Mock).mockResolvedValue({
      data: { user: null, session: null },
      error: null
    });

    // Mock verifyOtp
    (supabase.auth.verifyOtp as Mock).mockResolvedValue({
      data: {
        user: {},
        session: {}
      },
      error: null
    });

    // Mock sendSmsMessageNow
    const sendSmsMessageNowMock = sendSmsMessageNow as Mock;

    vi.spyOn(utils, 'getArgyleUserIdForDemoUser').mockResolvedValueOnce('abc');

    vi.spyOn(
      getDriverDataLinkFromArgyleUserId,
      'getDriverDataLinkFromArgyleUserId'
    ).mockResolvedValueOnce('https://www.getsystem.org/driver/data/{shortUserId}');

    const phoneNumber = '12222222223';

    // Create a mock request event
    const mockRequestEvent: Partial<MockRequestEvent> = {
      request: {
        json: async () => ({ phoneNumber })
      } as unknown as Request
    };

    // Run the test
    const response = await POST(mockRequestEvent as MockRequestEvent);

    expect(response.status).toBe(200);

    // Assertions for signInWithOtp
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '18009000010',
      options: { shouldCreateUser: false }
    });
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledTimes(1);

    // Assertions for verifyOtp
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      phone: '18009000010',
      token: '808181',
      type: 'sms'
    });
    expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(1);

    /* Assertions for SMS sending */

    // Sent two messages overall
    expect(sendSmsMessageNowMock).toHaveBeenCalledTimes(2);

    // Sent the welcome message first
    expect(sendSmsMessageNowMock).toHaveBeenNthCalledWith(1, {
      messageTemplateKey: 'welcome',
      messageArguments: {},
      phoneNumber
    });

    // Sent the take rate message second
    expect(sendSmsMessageNowMock).toHaveBeenNthCalledWith(2, {
      messageTemplateKey: 'view_take_rate',
      messageArguments: { driverDataLink: 'https://www.getsystem.org/driver/data/{shortUserId}' },
      phoneNumber
    });
  });
});
