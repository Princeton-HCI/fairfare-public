import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';

interface SendOtpPhoneNumberRequestBody {
  phoneNumber: string;
  userId?: never;
}

interface SendOtpUserIdRequestBody {
  userId: string;
  phoneNumber?: never;
}

type SendOtpRequestBody = SendOtpPhoneNumberRequestBody | SendOtpUserIdRequestBody;

const stripPhoneNumberStringOfNonDigits = (phoneNumber: string) => {
  return phoneNumber.replace(/\D/g, '');
};

export const POST = async (event: RequestEvent) => {
  const body: SendOtpRequestBody = await event.request.clone().json();

  if (!body) throw new Error('No request body found');

  if (!body.phoneNumber && !body.userId) {
    return new Response('No phone number or userId provided', { status: 400 });
  }

  let phone = '';
  if (body.phoneNumber) {
    phone = stripPhoneNumberStringOfNonDigits(body.phoneNumber);
  } else if (body.userId) {
    const profile = await getProfileFromUserId(supabase, body.userId);

    if (!profile?.phone) {
      // not a registered user with a phone number; we return a 200 to avoid leaking information
      return new Response('Sent if exists', { status: 200 });
    }

    phone = profile.phone;
  }

  // Silently fail if no phone number or userId is found
  if (phone === '') {
    return new Response('Sent if exists', { status: 200 });
  }

  console.log('Sending OTP to', phone);
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: false
    }
  });

  if (error) {
    if (error.message == 'Signups not allowed for otp') {
      console.log('Account with phone number', phone, 'does not exist');
      return new Response('Sent if exists', { status: 200 });
    }
    console.error('Error sending OTP', error);
    return new Response('Error sending OTP', { status: 500 });
  }

  return new Response('sent');
};
