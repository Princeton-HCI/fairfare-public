import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';

export const POST = async (event: RequestEvent) => {
  const { phoneNumber } = await event.request.json();

  if (!phoneNumber) {
    return new Response(JSON.stringify({ message: 'Missing phone number' }), { status: 400 });
  }

  // this is the first step of the otp flow, where the otp message is sent
  const { error: otpError } = await supabase.auth.signInWithOtp({
    phone: phoneNumber,
    options: {
      // this will *not* allow new users to be created
      shouldCreateUser: false
    }
  });
  if (otpError) {
    if (otpError.message === 'Signups not allowed for otp') {
      console.log(
        'Account with phone number',
        phoneNumber,
        'does not exist. Silently returning 200.'
      );
      return new Response('Sent if exists', { status: 200 });
    }
    console.error('Error sending OTP:', otpError);
    return new Response('', { status: 500 });
  }

  return new Response('', { status: 200 });
};
