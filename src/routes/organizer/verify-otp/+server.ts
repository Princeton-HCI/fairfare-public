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

  // here we set the user role to organizer if it's not already set
  const { error: roleError } = await supabase.from('user_roles').upsert(
    [
      {
        user_id: user.id,
        role: 'organizer'
      }
    ],
    { onConflict: 'user_id', ignoreDuplicates: true }
  );
  if (roleError) {
    console.error('Error adding organizer role:', roleError);
    return new Response('', { status: 500 });
  }

  // get the organization ID from the whitelist
  const { data: whitelistData, error: whitelistError } = await supabase
    .from('organizer_affiliations_phone_whitelist')
    .select('*, affiliate_organizations ( key )')
    .eq('phone_number', phone)
    .single();
  if (whitelistError) {
    console.error('Error getting whitelist:', whitelistError);
    return new Response('', { status: 500 });
  }

  // we also create the organizer affiliation
  const { error: affiliationError } = await supabase
    .from('organizer_affiliate_organization_affiliations')
    .upsert(
      [
        {
          user_id: user.id,
          affiliate_organization_id: whitelistData.affiliate_organization_id
        }
      ],
      { onConflict: 'user_id, affiliate_organization_id', ignoreDuplicates: true }
    );

  if (affiliationError) {
    console.error('Error adding organizer affiliation:', affiliationError);
    return new Response('', { status: 500 });
  }

  const organizationKey = whitelistData?.affiliate_organizations?.key;

  if (!organizationKey) {
    console.error('No organization key found:', whitelistData);
    return new Response('', { status: 500 });
  }

  return new Response(
    JSON.stringify({
      user,
      session,
      organizationKey
    }),
    { status: 200 }
  );
};
