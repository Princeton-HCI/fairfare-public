import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';
import { isDemoMode } from '@src/lib/utils';
import { DEMO_OTP, DEMO_PASSWORD_PREFIX } from '$lib/server/demo/constants';
import { postLoginPath } from '@src/lib/rbac';
import { loadAuthContext } from '@src/lib/server/rbac';
import { replaceDemoOrganizationMembership } from '@src/lib/server/organizationMembership';

/**
 * Handle demo mode organizer login - creates a unique organizer user per phone,
 * affiliates them with the requested org, and returns session.
 */
async function handleDemoOrganizerLogin(userPhone: string, organizationSignupCode: string) {
  const demoPassword = `${DEMO_PASSWORD_PREFIX}${userPhone}`;
  const demoEmail = `${userPhone}@demo.system.local`;

  // Try to sign in first (user might already exist from previous demo)
  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword
  });

  let userId: string;
  let session: { access_token: string; refresh_token: string };

  if (signInData?.session && signInData?.user) {
    userId = signInData.user.id;
    session = {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token
    };
  } else {
    // User doesn't exist, create new one
    const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { demo_phone: userPhone }
    });

    if (createError || !newUserData.user) {
      console.error('Failed to create demo organizer user:', createError);
      throw new Error('Demo organizer login failed - could not create user');
    }

    userId = newUserData.user.id;
    const { data: newSignInData, error: newSignInError } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword
    });

    if (newSignInError || !newSignInData.session) {
      console.error('Failed to sign in demo organizer:', newSignInError);
      throw new Error('Demo organizer login failed - could not create session');
    }

    session = {
      access_token: newSignInData.session.access_token,
      refresh_token: newSignInData.session.refresh_token
    };

    // Store phone in profile for display
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ phone: userPhone })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Failed to update demo organizer profile:', profileError);
      throw new Error('Demo organizer login failed - could not update profile');
    }
  }

  // Get org id for affiliation
  const { data: org, error: orgError } = await supabase
    .from('affiliate_organizations')
    .select('id, key')
    .eq('signup_code', organizationSignupCode)
    .eq('status', 'active')
    .single();

  if (orgError || !org) {
    const err = new Error('Demo organizer login failed - organization not found');
    throw Object.assign(err, { status: 400 });
  }

  const { error: roleUpsertError } = await supabase
    .from('user_roles')
    .upsert([{ user_id: userId, role: 'organizer' }], {
      onConflict: 'user_id',
      ignoreDuplicates: true
    });
  if (roleUpsertError) {
    console.error('Error adding demo organizer role:', roleUpsertError);
    throw new Error('Demo organizer login failed - could not assign role');
  }

  try {
    await replaceDemoOrganizationMembership(supabase, userId, org.id);
  } catch (affiliationUpsertError) {
    console.error('Error adding demo organizer affiliation:', affiliationUpsertError);
    throw new Error('Demo organizer login failed - could not create affiliation');
  }

  const roles = await loadAuthContext(supabase, userId);
  return {
    user: { id: userId },
    session,
    organizationKey: org.key,
    redirectTo: postLoginPath(roles, org.key)
  };
}

export const POST = async (event: RequestEvent) => {
  const { phone, token, signupCode } = await event.request.json();
  if (!phone) {
    return new Response('Missing phone number', { status: 400 });
  }
  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  if (isDemoMode && token !== DEMO_OTP) {
    return new Response(JSON.stringify({ message: 'Invalid demo code. Use 555555.' }), {
      status: 403
    });
  }

  if (isDemoMode && token === DEMO_OTP && !signupCode?.trim()) {
    return new Response(JSON.stringify({ message: 'Signup code is required in demo mode.' }), {
      status: 400
    });
  }

  if (isDemoMode && token === DEMO_OTP && signupCode) {
    try {
      const result = await handleDemoOrganizerLogin(phone, signupCode.trim());
      return new Response(
        JSON.stringify({
          user: result.user,
          session: result.session,
          organizationKey: result.organizationKey,
          redirectTo: result.redirectTo
        }),
        { status: 200 }
      );
    } catch (error) {
      console.error('Demo organizer login error:', error);
      const status =
        error instanceof Error && 'status' in error
          ? (error as Error & { status: number }).status
          : 500;
      return new Response(
        JSON.stringify({ message: 'Demo organizer login failed. Please try again.' }),
        { status }
      );
    }
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

  // The legacy `user_roles.role = 'organizer'` value is written only after the
  // caller actually joins an organization (below). Writing it here, before the
  // whitelist check, tagged any phone that merely verified an OTP as staff —
  // which, among other things, hides that person from the admin Drivers page.

  // Get the organization from the signup code (if provided)
  let targetOrgId: string | null = null;
  if (signupCode) {
    const { data: organizationData, error: organizationError } = await supabase
      .from('affiliate_organizations')
      .select('id')
      .eq('signup_code', signupCode)
      .eq('status', 'active')
      .single();

    if (organizationError || !organizationData) {
      console.error('Error getting organization from signup code:', organizationError);
      return new Response('', { status: 400 });
    }
    targetOrgId = organizationData.id;
  }

  // Get all whitelist entries for this phone number
  const { data: allWhitelistEntries, error: whitelistError } = await supabase
    .from('organizer_affiliations_phone_whitelist')
    .select('*, affiliate_organizations ( key )')
    .eq('phone_number', phone);

  if (whitelistError) {
    console.error('Error getting whitelist:', whitelistError);
    return new Response('', { status: 500 });
  }

  // The OTP has been verified, so the caller has proven they own this phone;
  // unlike /organizer/login (pre-OTP, anonymous) a specific message here is not
  // an oracle, so it can name what is actually missing.
  const signupCodeRequired = new Response(
    JSON.stringify({ message: 'Enter your organization signup code to log in' }),
    { status: 403 }
  );

  if (!allWhitelistEntries || allWhitelistEntries.length === 0) {
    console.error('No whitelist entries found for phone:', phone);
    return signupCodeRequired;
  }

  type WhitelistEntry = (typeof allWhitelistEntries)[number];

  // Determine which organization to use based off of signup code (in case phone number is affiliated with multiple orgs)
  let whitelistData: WhitelistEntry | undefined;
  if (targetOrgId) {
    // Use the organization from the signup code
    whitelistData = allWhitelistEntries.find(
      (entry: WhitelistEntry) => entry.affiliate_organization_id === targetOrgId
    );
    if (!whitelistData) {
      console.error('Signup code organization does not match any whitelist entry');
      return new Response('', { status: 403 });
    }
  }

  // No signup code and not a researcher/admin: there is no organization to join.
  if (!whitelistData) {
    console.error('A signup code is required to join an organization');
    return signupCodeRequired;
  }

  try {
    // Recheck the invite under the same organization lock used by revocation.
    const { error: affiliationError } = await supabase.rpc('join_organization_from_invite', {
      p_user_id: user.id,
      p_organization_id: whitelistData.affiliate_organization_id
    });
    if (affiliationError) throw affiliationError;
  } catch (affiliationError) {
    console.error('Error adding organizer affiliation:', affiliationError);
    const revoked = (affiliationError as { code?: string }).code === '42501';
    return new Response('', { status: revoked ? 403 : 500 });
  }

  // The caller has joined an organization, so tag the legacy platform role.
  // `ignoreDuplicates` keeps an existing researcher/admin/driver role intact.
  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert([{ user_id: user.id, role: 'organizer' }], {
      onConflict: 'user_id',
      ignoreDuplicates: true
    });
  if (roleError) {
    console.error('Error adding organizer role:', roleError);
    return new Response('', { status: 500 });
  }

  const organizationKey = whitelistData?.affiliate_organizations?.key;

  if (!organizationKey) {
    console.error('No organization key found:', whitelistData);
    return new Response('', { status: 500 });
  }

  const roles = await loadAuthContext(supabase, user.id);
  return new Response(
    JSON.stringify({
      user,
      session,
      organizationKey,
      redirectTo: postLoginPath(roles, organizationKey)
    }),
    { status: 200 }
  );
};
