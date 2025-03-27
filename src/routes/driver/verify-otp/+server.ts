import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';

export const POST = async (event: RequestEvent) => {
  const { phone, token } = await event.request.json();
  if (!phone) {
    return new Response('Missing phone number', { status: 400 });
  }
  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  const {
    data: { user, session },
    error
  } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });

  if (error?.name === 'AuthApiError' && error?.message === 'Token has expired or is invalid') {
    return new Response(JSON.stringify({ message: 'Token has expired or is invalid' }), {
      status: 403
    });
  }

  if (error || !user || !session) {
    console.error('Error verifying OTP:', error);
    return new Response('', { status: 500 });
  }
  return new Response(
    JSON.stringify({
      user,
      session
    }),
    { status: 200 }
  );
};
