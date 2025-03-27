import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';

export const POST = async (event: RequestEvent) => {
  // check the user against the organizer_affiliations_phone_whitelist
  // if they're not on the whitelist, return a 403

  const { phoneNumber, signupCode } = await event.request.json();

  if (!phoneNumber) {
    return new Response(JSON.stringify({ message: 'Missing phone number' }), { status: 400 });
  }
  if (!signupCode) {
    return new Response(JSON.stringify({ message: 'Missing signup code' }), { status: 400 });
  }

  // check the organization
  const { data: organizationData, error: organizationError } = await supabase
    .from('affiliate_organizations')
    .select('id')
    .eq('signup_code', signupCode);

  if (organizationError) {
    return new Response('', { status: 500 });
  }

  // if the organization doesn't exist, return a 403
  if (!organizationData || !organizationData[0]?.id) {
    return new Response(JSON.stringify({ message: 'Signup code not found' }), { status: 403 });
  }

  // check if the number is on the whitelist
  const { error: whitelistError } = await supabase
    .from('organizer_affiliations_phone_whitelist')
    .select('*')
    .eq('phone_number', phoneNumber)
    .eq('affiliate_organization_id', organizationData[0].id)
    .single();

  if (whitelistError) {
    console.error('Error getting whitelist:', whitelistError);
    return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 403 });
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
