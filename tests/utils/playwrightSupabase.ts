/**
 * Supabase client utilities for Playwright e2e tests.
 *
 * These use process.env directly (loaded via dotenv)
 * instead of $env/static/private which only works with vitest.
 */

import { config } from 'dotenv';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

config(); // Load .env into process.env for Playwright tests

/**
 * Creates a Supabase client with service role access for Playwright tests.
 * Use this for test setup/teardown operations that require admin privileges.
 */
export function createPlaywrightSupabaseClient(): SupabaseClient {
  const url = process.env.PUB_VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing required environment variables: PUB_VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set'
    );
  }

  return createClient(url, serviceKey);
}

/**
 * Creates a test user and sets their argyle_user field.
 * Use this when testing webhooks that require a user with an argyle_user.
 *
 * @param argyleUser - The Argyle user ID to set on the profile
 * @returns The created user's ID
 */
export async function createTestUserWithArgyleUser(argyleUser: string): Promise<string> {
  const supabase = createPlaywrightSupabaseClient();
  const testEmail = `test-webhook-${Date.now()}@test.test`;

  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'password',
    email_confirm: true
  });

  if (createError) throw createError;
  const userId = userData.user.id;

  // Update the profile to set argyle_user
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ argyle_user: argyleUser })
    .eq('user_id', userId);

  if (updateError) throw updateError;

  return userId;
}

/**
 * Deletes a test user by their user ID.
 * Use this in afterEach hooks to clean up test data.
 *
 * @param userId - The user ID to delete
 */
export async function teardownTestUser(userId: string): Promise<void> {
  const supabase = createPlaywrightSupabaseClient();
  await supabase.auth.admin.deleteUser(userId);
}

/**
 * Maximum cookie chunk size before splitting into multiple cookies.
 * Matches @supabase/ssr's chunking logic to stay under the 4096-byte cookie limit.
 */
const COOKIE_CHUNK_SIZE = 3180;

/**
 * Programmatically log in a test user by setting Supabase session cookies
 * directly in the browser context — no OTP UI flow, no rate limits.
 *
 * This avoids Supabase Auth's 60-second per-phone-number OTP cooldown that
 * causes flaky tests when multiple tests share the same phone number.
 *
 * Use this for any test that needs an authenticated user but is NOT testing
 * the login/OTP flow itself. Test 01 already covers the real OTP path.
 *
 * Call this BEFORE page.goto() — the cookies must be set before the first
 * navigation so the server sees a valid session.
 *
 * @param page - Playwright Page (cookies are set on its browser context)
 * @param phone - Phone number to authenticate with (e.g. '18009000020')
 */
export async function loginProgrammatically(page: Page, phone: string): Promise<void> {
  const supabaseUrl = process.env.PUB_VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.PUB_VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey || !anonKey) {
    throw new Error(
      'loginProgrammatically: Missing required env vars ' +
        '(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, PUB_VITE_SUPABASE_ANON_KEY)'
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${serviceKey}`
      }
    }
  });

  const testPassword = `test-pw-${phone}`;

  // Create user with phone + password, or update existing user's password.
  // Users may already exist from OTP-based tests that ran earlier.
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    phone,
    phone_confirm: true,
    password: testPassword
  });

  let userId: string;

  if (createError) {
    // The user already exists — either from an earlier test, or because a
    // parallel worker logged in as the same phone at the same moment. A
    // concurrent create loses with a 500 "Database error creating new user"
    // and can return *before* the winner's row is committed, so retry the
    // lookup briefly rather than giving up on the first empty sweep.
    let existingUser: User | undefined;
    for (let attempt = 0; attempt < 10 && !existingUser; attempt++) {
      // listUsers() defaults to 50 per page; in CI the user may be on a later page.
      let page = 1;
      const perPage = 500;
      while (!existingUser) {
        const {
          data: { users }
        } = await admin.auth.admin.listUsers({ page, perPage });
        existingUser = users.find((u) => u.phone === phone);
        if (existingUser || users.length < perPage) break;
        page++;
      }
      if (!existingUser) await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (!existingUser) {
      throw new Error(
        `loginProgrammatically: Failed to create user (${createError.message}) ` +
          `and could not find existing user with phone ${phone}`
      );
    }

    userId = existingUser.id;

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: testPassword
    });
    if (updateError) {
      throw new Error(
        `loginProgrammatically: Failed to update password for user ${userId}: ${updateError.message}`
      );
    }
  } else {
    userId = createData.user.id;
  }

  // Ensure the user has an argyle_user on their profile.
  // The normal OTP login flow (via /driver/verify-otp) creates one via the
  // Argyle API. We replicate that here so server-side code like getUserToken()
  // works correctly.
  //
  // The profile is created by a database trigger after user creation, so we
  // retry the lookup briefly in case the trigger hasn't fired yet.
  let profile: { argyle_user: string | null } | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await admin
      .from('profiles')
      .select('argyle_user')
      .eq('user_id', userId)
      .single();
    if (data) {
      profile = data;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!profile?.argyle_user) {
    // Create a real Argyle user (same as /driver/verify-otp does)
    const argyleUrl = process.env.PUB_ARGYLE_LINK_URL;

    // Against the local stub (tests/argyleStub.ts) any credentials will do, so a
    // checkout without Argyle keys can still run the suite. Against the real
    // sandbox, missing keys should fail loudly rather than 401 halfway through.
    const usingStub = !!argyleUrl && new URL(argyleUrl).hostname === '127.0.0.1';
    const argyleApiKey = process.env.VITE_ARGYLE_API_KEY ?? (usingStub ? 'stub-key' : undefined);
    const argyleApiSecret =
      process.env.VITE_ARGYLE_API_SECRET ?? (usingStub ? 'stub-secret' : undefined);

    if (!argyleUrl || !argyleApiKey || !argyleApiSecret) {
      throw new Error(
        'loginProgrammatically: Missing Argyle env vars ' +
          '(PUB_ARGYLE_LINK_URL, VITE_ARGYLE_API_KEY, VITE_ARGYLE_API_SECRET)'
      );
    }

    const argyleAuthString = Buffer.from(`${argyleApiKey}:${argyleApiSecret}`).toString('base64');
    const argyleResponse = await fetch(`${argyleUrl}/v2/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Basic ${argyleAuthString}`
      }
    });

    if (!argyleResponse.ok) {
      throw new Error(
        `loginProgrammatically: Failed to create Argyle user: ${argyleResponse.status} ${await argyleResponse.text()}`
      );
    }

    const argyleData = (await argyleResponse.json()) as { id: string };
    const { error: argyleUpdateError } = await admin
      .from('profiles')
      .update({ argyle_user: argyleData.id })
      .eq('user_id', userId);

    if (argyleUpdateError) {
      throw new Error(
        `loginProgrammatically: Failed to set argyle_user on profile: ${argyleUpdateError.message}`
      );
    }
  }

  // Sign in with password to get session tokens (no OTP, no rate limits)
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false }
  });

  const { data, error: signInError } = await anonClient.auth.signInWithPassword({
    phone,
    password: testPassword
  });

  if (signInError) {
    throw new Error(
      `loginProgrammatically: signInWithPassword failed for ${phone}: ${signInError.message}`
    );
  }

  // Build the cookie name that @supabase/ssr expects
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  const storageKey = `sb-${ref}-auth-token`;

  const sessionStr = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.session.expires_in,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user
  });

  // Set session cookies, chunking if needed (matches @supabase/ssr behavior)
  const cookies: { name: string; value: string; domain: string; path: string }[] = [];

  if (sessionStr.length <= COOKIE_CHUNK_SIZE) {
    cookies.push({ name: storageKey, value: sessionStr, domain: 'localhost', path: '/' });
  } else {
    let remaining = sessionStr;
    let i = 0;
    while (remaining.length > 0) {
      cookies.push({
        name: `${storageKey}.${i}`,
        value: remaining.slice(0, COOKIE_CHUNK_SIZE),
        domain: 'localhost',
        path: '/'
      });
      remaining = remaining.slice(COOKIE_CHUNK_SIZE);
      i++;
    }
  }

  await page.context().addCookies(cookies);
}

/**
 * Programmatically log in an email/password user (admin console).
 * Does not create an Argyle user — admin and researcher fixtures do not need one.
 */
export async function loginProgrammaticallyWithEmail(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const supabaseUrl = process.env.PUB_VITE_SUPABASE_URL;
  const anonKey = process.env.PUB_VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'loginProgrammaticallyWithEmail: Missing PUB_VITE_SUPABASE_URL or PUB_VITE_SUPABASE_ANON_KEY'
    );
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false }
  });

  const { data, error: signInError } = await anonClient.auth.signInWithPassword({
    email,
    password
  });

  if (signInError || !data.session) {
    throw new Error(
      `loginProgrammaticallyWithEmail: signInWithPassword failed for ${email}: ${signInError?.message}`
    );
  }

  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  const storageKey = `sb-${ref}-auth-token`;
  const sessionStr = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.session.expires_in,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user
  });

  await page
    .context()
    .addCookies([{ name: storageKey, value: sessionStr, domain: 'localhost', path: '/' }]);
}
