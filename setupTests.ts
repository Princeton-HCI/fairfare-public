import { config } from 'dotenv';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
import { createClient } from '@supabase/supabase-js';

config(); // Load env vars

/**
 * Set up handlers for msw
 */

export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({
    onUnhandledRequest(request, print) {
      // Do not print warnings on unhandled requests to supabase
      if (
        request.url.startsWith('http://localhost:54321/auth') ||
        request.url.startsWith('http://localhost:54321/rest') ||
        request.url.startsWith('http://127.0.0.1:54321/auth') ||
        request.url.startsWith('http://127.0.0.1:54321/rest')
      ) {
        return;
      }

      // Print the regular MSW unhandled request warning otherwise.
      print.warning();
    }
  });
  return deleteAllTestUsers();
});
afterAll(() => {
  server.close();
});

/**
 * Initialize test supabase and mock it
 */

const TEST_PUB_VITE_SUPABASE_URL = process.env.PUB_VITE_SUPABASE_URL;
const TEST_SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const isValidTestEmail = (email: string): boolean => {
  return email.endsWith('@test.test') || email.endsWith('@getsystem.org');
};

const deleteAllTestUsers = async () => {
  /**
   * Delete all test users.
   * This is useful for cleaning up after tests, and should always be run after
   * `createTestUserByEmail` is run.
   *
   */
  if (!TEST_PUB_VITE_SUPABASE_URL || !TEST_SUPABASE_SERVICE_KEY)
    throw new Error('Missing env vars for setupTests');
  const supabase = createClient(TEST_PUB_VITE_SUPABASE_URL, TEST_SUPABASE_SERVICE_KEY);

  const { data, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 9999
  });
  if (usersError) {
    console.log('Error listing users:', usersError);
    throw usersError;
  }

  // for each, delete
  for (const user of data.users) {
    if (user.email && isValidTestEmail(user.email)) {
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteUserError) {
        console.log('Error deleting user:', deleteUserError);
        if (deleteUserError.message !== 'User not found') throw deleteUserError;
      }
    }
  }
};
