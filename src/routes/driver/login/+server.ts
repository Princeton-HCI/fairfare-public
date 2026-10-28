import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';
import { isDemoMode } from '@src/lib/utils';

export const POST = async (event: RequestEvent) => {
  const { phoneNumber } = await event.request.json();

  if (!phoneNumber) {
    return new Response(JSON.stringify({ message: 'Missing phone number' }), { status: 400 });
  }

  // In demo mode, skip sending real SMS - the verify-otp endpoint handles demo auth
  // with a fixed OTP (555555) and the sandbox user
  if (isDemoMode) {
    return new Response('', { status: 200 });
  }

  // this is the first step of the otp flow, where the otp message is sent
  const { error: otpError } = await supabase.auth.signInWithOtp({
    phone: phoneNumber,
    options: {
      // this will *allow* new users to be created
      shouldCreateUser: true
    }
  });
  if (otpError) {
    console.error('Error sending OTP:', otpError);
    return new Response('', { status: 500 });
  }

  return new Response('', { status: 200 });
};
