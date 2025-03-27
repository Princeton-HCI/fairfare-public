/**
 * Utils for integration tests that involve creating and deleting test users.
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_KEY } from '$env/static/private';
import { PUB_VITE_SUPABASE_URL } from '$env/static/public';
import type { SupabaseClient } from '@supabase/supabase-js';

const createSupabaseClient = (): SupabaseClient => {
  return createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  });
};

const isValidTestEmail = (email: string): boolean => {
  return email.endsWith('@test.test') || email.endsWith('@getsystem.org');
};

const isValidTestPhone = (phone: string): boolean => {
  // should have 1XXX555XXXX
  return phone.match(/^1\d{3}555\d{4}$/) !== null;
};

const createTestUserByEmail = async (email: string, email_confirm: boolean = false) => {
  /**
   * Create a test user with a test email.
   * We use emails that end with `@test.test` to avoid sending real emails.
   *
   * Teardown is handled by `teardownTestUserByUserId`.
   *
   * @param email - the email to use for the test user
   * @param email_confirm - whether to confirm the email
   */

  const supabase = createSupabaseClient();
  // (1) validate email
  if (!isValidTestEmail(email)) {
    throw new Error('createTestUserByEmail: email must end with @test.test or @getsystem.org');
  }

  // try to create the user, if AuthApiError is thrown, the user already exists, so delete it and try again
  let user;
  while (!user) {
    try {
      // (2) make a user to test with
      const { data: signupData, error } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: 'password',
        email_confirm
      });
      if (error) throw error;
      user = signupData?.user;
    } catch (error) {
      // @ts-expect-error Property 'message' does not exist on type '{}'.ts(2339)
      // This is fine since we use ?.message below.
      if (error?.message === 'A user with this email address has already been registered') {
        console.log('createTestUserByEmail: user already registered, deleting and trying again');
        // --- delete the user and try again ---

        // get the user id
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', email.toLowerCase());

        if (userError) {
          throw userError;
        }
        const userIds = userData?.map((user: any) => user.user_id);
        console.log('[testUser] got userId(s):', userIds);

        if (userIds.length < 1)
          throw new Error('createTestUserByEmail: user id not found ' + email);

        for (const userId of userIds) {
          const resp = await supabase.auth.admin.deleteUser(userId);
          const deleteUserError = resp.error;
          if (deleteUserError) {
            console.error('Error deleting user:', deleteUserError);
            throw deleteUserError;
          }
        }
      } else {
        throw error;
      }
      continue;
    }
  }

  return user;
};

const createTestUserByPhone = async (phone: string, phone_confirm: boolean = false) => {
  /**
   * Create a test user with a test phone.
   * We use phone numbers like `1XXX555XXXX` to avoid sending real texts.
   *
   * Teardown is handled by `teardownTestUserByUserId`.
   *
   * @param phone - the phone to use for the test user
   * @param phone_confirm - whether to confirm the phone
   */

  const supabase = createSupabaseClient();
  // (1) validate email
  if (!isValidTestPhone(phone)) {
    throw new Error('createTestUserByPhone: phone must match "1XXX555XXXX"');
  }

  // try to create the user, if AuthApiError is thrown, the user already exists, so delete it and try again
  let user;
  while (!user) {
    try {
      // (2) make a user to test with
      const { data: signupData, error } = await supabase.auth.admin.createUser({
        phone: phone,
        password: 'password',
        phone_confirm: true
      });
      if (error) throw error;
      user = signupData?.user;
    } catch (error) {
      // @ts-expect-error Property 'message' does not exist on type '{}'.ts(2339)
      // This is fine since we use ?.message below.
      if (error?.message === 'Phone number already registered by another user') {
        console.log('createTestUserByPhone: user already registered, deleting and trying again');
        // --- delete the user and try again ---

        // get the user id
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('phone', phone);

        if (userError) {
          throw userError;
        }
        const userIds = userData?.map((user: { user_id: string }) => user.user_id);
        console.log('[createTestUserByPhone] got userId(s):', userIds);

        if (userIds.length < 1)
          throw new Error('createTestUserByPhone: user id not found ' + phone);

        for (const userId of userIds) {
          const resp = await supabase.auth.admin.deleteUser(userId);
          const deleteUserError = resp.error;
          if (deleteUserError) {
            console.error('Error deleting user:', deleteUserError);
            throw deleteUserError;
          }
        }
      } else {
        throw error;
      }
      continue;
    }
  }

  return user;
};

const teardownTestUserByUserId = async (userId: string) => {
  /**
   * Delete a test user by their user id.
   * This is useful for cleaning up after tests, and should always be run after
   * `createTestUserByEmail` is run.
   *
   * @param supabase - the supabase client
   * @param userId - the user id to delete
   */
  const supabase = createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    console.error('Error deleting user:', deleteUserError);
    if (deleteUserError.message !== 'User not found') throw deleteUserError;
  }
};

export { createTestUserByEmail, createTestUserByPhone, teardownTestUserByUserId };
