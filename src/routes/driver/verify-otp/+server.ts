import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';
import { isDemoMode } from '@src/lib/utils';
import { DEMO_OTP, DEMO_PASSWORD_PREFIX } from '$lib/server/demo/constants';

/**
 * Handle demo mode login - creates a unique user for each phone number
 * Uses admin API to create user with password, then signs in with password
 */
async function handleDemoLogin(userPhone: string) {
  const demoPassword = `${DEMO_PASSWORD_PREFIX}${userPhone}`;
  const demoEmail = `${userPhone}@demo.system.local`;

  // Try to sign in first (user might already exist from previous demo)
  const { data: signInData, error: _signInError } = await supabase.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword
  });

  if (signInData?.session && signInData?.user) {
    return { user: signInData.user, session: signInData.session };
  }

  // User doesn't exist, create new one.
  // Note: We intentionally omit `phone` from the auth user to avoid conflicts
  // with users who previously logged in via normal OTP (phone must be unique in auth.users).
  // The phone is stored in the profile for display purposes instead.
  const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
    email: demoEmail,
    password: demoPassword,
    email_confirm: true,
    user_metadata: {
      demo_phone: userPhone
    }
  });

  if (createError || !newUserData.user) {
    console.error('Failed to create demo user:', createError);
    throw new Error('Demo login failed - could not create user');
  }

  // Now sign in to get a session
  const { data: newSignInData, error: newSignInError } = await supabase.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword
  });

  if (newSignInError || !newSignInData.session) {
    console.error('Failed to sign in demo user:', newSignInError);
    throw new Error('Demo login failed - could not create session');
  }

  // Store the user's actual phone for display
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      phone: userPhone,
      first_name: 'Demo',
      last_initial: 'Driver'
    })
    .eq('user_id', newUserData.user.id);

  if (profileError) {
    console.error('Error updating demo profile:', profileError);
  }

  return { user: newSignInData.user, session: newSignInData.session };
}

export const POST = async (event: RequestEvent) => {
  const { phone, token } = await event.request.json();
  if (!phone) {
    return new Response('Missing phone number', { status: 400 });
  }
  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  let user;
  let session;
  let isDemo = false;

  // Handle demo mode: accept only the fixed demo OTP, reject anything else
  if (isDemoMode) {
    if (token !== DEMO_OTP) {
      return new Response(JSON.stringify({ message: 'Invalid demo code. Use 555555.' }), {
        status: 403
      });
    }
    try {
      const result = await handleDemoLogin(phone);
      user = result.user;
      session = result.session;
      isDemo = true;
    } catch (error) {
      console.error('Demo login error:', error);
      return new Response(JSON.stringify({ message: 'Demo login failed. Please try again.' }), {
        status: 500
      });
    }
  } else {
    // Normal OTP verification flow
    const {
      data: { user: authUser, session: authSession },
      error
    } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });

    if (error?.name === 'AuthApiError' && error?.message === 'Token has expired or is invalid') {
      return new Response(JSON.stringify({ message: 'Token has expired or is invalid' }), {
        status: 403
      });
    }

    if (error || !authUser || !authSession) {
      console.error('Error verifying OTP:', error);
      return new Response('', { status: 500 });
    }

    user = authUser;
    session = authSession;
  }

  // NOTE: argyle_user is no longer eagerly created here. It's created
  // lazily by /api/driver/argyle/bootstrap on the driver's first Argyle Link
  // attempt — and crucially against the correct Argyle tenant (global for
  // legacy drivers, org-scoped for drivers signing up through an org link).

  return new Response(
    JSON.stringify({
      user,
      session,
      ...(isDemo && { demoMode: true })
    }),
    { status: 200 }
  );
};
