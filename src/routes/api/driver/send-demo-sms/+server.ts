import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';
import sendSmsMessageNow from '@src/lib/smsMessages/sendSmsMessageNow';
import { getDriverDataLinkFromArgyleUserId } from '@src/routes/api/driver/argyle/webhooks/sendTakeRateMessageIfElegibleToArgyleUser';
import { getArgyleUserIdForDemoUser } from './utils';

interface DemoMessageRequestBody {
  phoneNumber: string;
}

const DELAY_SECONDS = 6; // Delay in seconds

// This is one of the demo phone numbers from the Argyle sandbox accounts
const DEMO_USER_PHONENUMBER = '18009000010';

// This is a hardcoded OTP that we have in our Supabase configuration
const DEMO_USER_OTP = '808181';

const DEMO_BASE_URL = 'https://demo.getsystem.org/';

// Utility function to validate phone numbers (must be 11 digits)
const validatePhoneNumber = (phoneNumber: string): boolean => /^\d{11}$/.test(phoneNumber);

// Utility function to introduce a delay using Promises
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const POST = async (event: RequestEvent) => {
  // Parse and validate the request body
  const { phoneNumber } = (await event.request.json()) as DemoMessageRequestBody;

  if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
    return new Response('Invalid phone number. Must be 11 digits.', { status: 400 });
  }

  // Step 1: Send OTP to the demo phone number
  // (this won't actually send an SMS since this is a test_otp number in Supabase)
  const { error: otpError } = await supabase.auth.signInWithOtp({
    phone: DEMO_USER_PHONENUMBER,
    options: {
      shouldCreateUser: false
    }
  });

  if (otpError) throw new Error(`Sign in failed: ${otpError.message}`);

  // Step 2: Verify the OTP
  const {
    data: { user, session },
    error: verifyError
  } = await supabase.auth.verifyOtp({
    phone: DEMO_USER_PHONENUMBER,
    token: DEMO_USER_OTP,
    type: 'sms'
  });

  if (verifyError) throw new Error(`OTP verification failed: ${verifyError.message}`);

  if (!user || !session) throw new Error('User or session is null after OTP verification');

  // Step 3: Get the Argyle user ID for the demo user
  const argyleUserId = await getArgyleUserIdForDemoUser();

  // Step 4: Generate driver data link using Argyle user ID
  const driverDataLink = await getDriverDataLinkFromArgyleUserId(argyleUserId, DEMO_BASE_URL);

  // Step 5: Send a welcome message immediately
  await sendSmsMessageNow({
    messageTemplateKey: 'welcome',
    messageArguments: {},
    phoneNumber
  });

  // Step 6: Schedule follow-up message with driver data link after a delay
  await delay(DELAY_SECONDS * 1000); // Wait for DELAY_SECONDS before sending the follow-up SMS

  await sendSmsMessageNow({
    messageTemplateKey: 'view_take_rate',
    messageArguments: { driverDataLink },
    phoneNumber
  });

  return new Response('Demo message sent successfully', { status: 200 });
};
