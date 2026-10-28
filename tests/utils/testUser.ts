/**
 * Utils for integration tests that create and delete test users.
 *
 * Test identities must be unique per test. The suite runs files in parallel and
 * a local database keeps its rows between runs, so a hardcoded address is a
 * collision waiting to happen: two files racing on the same email, or a user
 * left behind by an earlier failed run holding the phone number a later run
 * needs. Build addresses with `uniqueTestEmail` / `uniqueTestPhone` and tear
 * them down with `teardownTestUserByUserId`.
 */

import { randomUUID } from 'crypto';
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

/**
 * Numbers pinned to a fixed OTP in supabase/config.toml. A generated phone must
 * never land on one of these — the fixture would steal a number that the login
 * tests need to be able to sign in with.
 */
const RESERVED_TEST_PHONES = new Set([
  '12223334444',
  '18009000010',
  '18009000020',
  '18009000030',
  '19998882222',
  '19995559999',
  '12025552222',
  '19995552222',
  '19995551111',
  '19995553333'
]);

/**
 * An address no other test holds: `<prefix>-<uuid>@test.test`.
 *
 * The prefix is for humans reading a failure or a leftover row; uniqueness comes
 * from the uuid. Use one per user, not one per file.
 */
const uniqueTestEmail = (prefix: string): string => {
  const slug = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${randomUUID()}@test.test`;
};

/**
 * A phone in the `1XXX555XXXX` test range that no other test holds.
 *
 * Only for users whose phone is incidental profile data. A test that signs in
 * over OTP needs one of the numbers pinned in supabase/config.toml instead.
 */
const uniqueTestPhone = (): string => {
  const digits = (count: number) =>
    Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join('');

  let phone = '';
  do {
    phone = `1${digits(3)}555${digits(4)}`;
  } while (RESERVED_TEST_PHONES.has(phone));

  return phone;
};

const createTestUserByEmail = async (email: string, email_confirm: boolean = false) => {
  /**
   * Create a test user with a test email.
   * We use emails that end with `@test.test` to avoid sending real emails.
   *
   * Pass `uniqueTestEmail('some-prefix')` rather than a literal address.
   * Teardown is handled by `teardownTestUserByUserId`.
   *
   * @param email - the email to use for the test user
   * @param email_confirm - whether to confirm the email
   */

  const supabase = createSupabaseClient();
  if (!isValidTestEmail(email)) {
    throw new Error('createTestUserByEmail: email must end with @test.test or @getsystem.org');
  }

  const { data: signupData, error } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password: 'password',
    email_confirm
  });

  if (error) {
    throw new Error(
      `createTestUserByEmail: could not create ${email}: ${error.message}. ` +
        'If this is a duplicate, the address is not unique — build it with uniqueTestEmail().'
    );
  }
  if (!signupData?.user) {
    throw new Error(`createTestUserByEmail: no user returned for ${email}`);
  }

  return signupData.user;
};

const createTestUserByPhone = async (phone: string, phone_confirm: boolean = true) => {
  /**
   * Create a test user with a test phone.
   * We use phone numbers like `1XXX555XXXX` to avoid sending real texts.
   *
   * Pass `uniqueTestPhone()` unless the test signs in over OTP, which needs one
   * of the numbers pinned in supabase/config.toml.
   * Teardown is handled by `teardownTestUserByUserId`.
   *
   * @param phone - the phone to use for the test user
   * @param phone_confirm - whether to confirm the phone
   */

  const supabase = createSupabaseClient();
  if (!isValidTestPhone(phone)) {
    throw new Error('createTestUserByPhone: phone must match "1XXX555XXXX"');
  }

  const { data: signupData, error } = await supabase.auth.admin.createUser({
    phone,
    password: 'password',
    phone_confirm
  });

  if (error) {
    throw new Error(
      `createTestUserByPhone: could not create ${phone}: ${error.message}. ` +
        'If this is a duplicate, the number is not unique — build it with uniqueTestPhone().'
    );
  }
  if (!signupData?.user) {
    throw new Error(`createTestUserByPhone: no user returned for ${phone}`);
  }

  return signupData.user;
};

/**
 * Deletes whoever currently holds `phone`, if anyone.
 *
 * For the handful of specs that need one of the numbers pinned to a fixed OTP in
 * supabase/config.toml: those cannot be made unique, so they are a shared
 * resource, and a run that dies before teardown leaves a user holding one. Call
 * this before claiming a pinned number so the spec starts from a known state
 * instead of failing on users_phone_key.
 */
const releaseTestPhone = async (phone: string) => {
  const supabase = createSupabaseClient();
  const normalized = phone.replace(/\D/g, '');

  let page = 1;
  const perPage = 500;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const holder = data.users.find((user) => user.phone?.replace(/\D/g, '') === normalized);
    if (holder) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(holder.id);
      if (deleteError && deleteError.message !== 'User not found') throw deleteError;
      return;
    }

    if (data.users.length < perPage) return;
    page++;
  }
};

const teardownTestUserByUserId = async (userId: string) => {
  /**
   * Delete a test user by their user id.
   * This is useful for cleaning up after tests, and should always be run after
   * `createTestUserByEmail` is run.
   *
   * @param userId - the user id to delete
   */
  const supabase = createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    console.error('Error deleting user:', deleteUserError);
    if (deleteUserError.message !== 'User not found') throw deleteUserError;
  }
};

export {
  createTestUserByEmail,
  createTestUserByPhone,
  releaseTestPhone,
  teardownTestUserByUserId,
  uniqueTestEmail,
  uniqueTestPhone
};
