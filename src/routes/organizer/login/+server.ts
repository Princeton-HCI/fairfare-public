import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';
import { isDemoMode } from '@src/lib/utils';

export const POST = async (event: RequestEvent) => {
  // check the user against the organizer_affiliations_phone_whitelist
  // if they're not on the whitelist, return a 403

  const { phoneNumber, signupCode } = await event.request.json();

  if (!phoneNumber) {
    return new Response(JSON.stringify({ message: 'Missing phone number' }), { status: 400 });
  }

  // Everyone who signs in here is joining an organization, so the code is
  // required. Admins and researchers sign in at `/admin/login` with an email and
  // password instead. The refusal does not depend on the phone number, so it
  // says nothing about who the caller is.
  if (!signupCode) {
    return new Response(
      JSON.stringify({ message: 'Enter your organization signup code to log in' }),
      { status: 400 }
    );
  }

  // check the organization
  const { data: organizationData, error: organizationError } = await supabase
    .from('affiliate_organizations')
    .select('id')
    .eq('signup_code', signupCode)
    .eq('status', 'active');

  if (organizationError) {
    return new Response('', { status: 500 });
  }

  // A wrong code and a valid code with a phone that is not whitelisted must be
  // indistinguishable, or an anonymous caller can first confirm an
  // organization's code and then probe which phones it has invited.
  const denied = () =>
    new Response(JSON.stringify({ message: 'Invalid signup code or phone number' }), {
      status: 403
    });

  if (!organizationData || !organizationData[0]?.id) {
    return denied();
  }

  // In demo mode, skip whitelist check and SMS - verify-otp handles demo auth with fixed OTP
  if (isDemoMode) {
    return new Response('', { status: 200 });
  }

  // check if the number is on the whitelist
  const { error: whitelistError } = await supabase
    .from('organizer_affiliations_phone_whitelist')
    .select('*')
    .eq('phone_number', phoneNumber)
    .eq('affiliate_organization_id', organizationData[0].id)
    .single();

  if (whitelistError) {
    return denied();
  }

  // this is the first step of the otp flow,
  // where the otp message is sent
  // this will work for both new and existing users
  const { error: otpError } = await supabase.auth.signInWithOtp({
    phone: phoneNumber
  });
  if (otpError) {
    console.error('Error sending OTP:', otpError);
    return new Response('', { status: 500 });
  }

  return new Response('', { status: 200 });
};
