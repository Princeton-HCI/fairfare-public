import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';

type VerifyOtpRequestWithUserIdBody = {
  token: string;
  userId: string;
};
type VerifyOtpRequestWithPhoneNumberBody = {
  token: string;
  phone: string;
};

type VerifyOtpRequestBody = VerifyOtpRequestWithUserIdBody | VerifyOtpRequestWithPhoneNumberBody;

export const POST = async (event: RequestEvent) => {
  const body: VerifyOtpRequestBody = await event.request.clone().json();

  const { token } = body;
  if (!token) return new Response('No token provided', { status: 400 });

  let phone = '';
  if ('userId' in body) {
    const { userId } = body;

    if (!userId) return new Response('No userId provided', { status: 400 });
    // look up the phone number from the user id
    const profile = await getProfileFromUserId(supabase, userId);

    if (!profile) {
      return new Response('User not found', { status: 404 });
    }

    if (!profile.phone) {
      return new Response('User has no phone number', { status: 400 });
    }
    phone = profile.phone;
  } else if ('phone' in body) {
    phone = body.phone;
    if (!phone) return new Response('No phone provided', { status: 400 });
  } else {
    return new Response('Invalid request', { status: 400 });
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms'
  });

  if (error) {
    // If the error is the wrong code, we return a 400
    if (error.message === 'Token has expired or is invalid') {
      return new Response('Token has expired or is invalid', { status: 400 });
    }
    console.error('Error verifying OTP', error);
    return new Response('Error verifying OTP', { status: 500 });
  }

  return new Response(
    JSON.stringify({
      user: data.user,
      session: data.session
    }),
    { status: 200 }
  );
};
