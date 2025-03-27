import type { AuthResponse } from '@supabase/supabase-js';
import { supabase } from '@src/lib/server/db';
import { SUPABASE_DEFAULT_PASSWORD } from '$env/static/private';
import { updateProfileByUserId } from '../databaseHelpers';

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import { SUPABASE_SERVICE_KEY } from '$env/static/private';
import { PUB_VITE_SUPABASE_URL } from '$env/static/public';

const createTemporaryUser = async (argyleUserId: string): Promise<AuthResponse> => {
  // Format: XXX555XXXX
  // https://en.wikipedia.org/wiki/Fictitious_telephone_number
  const randomTemporaryPhone =
    Math.floor(100 + Math.random() * 900).toString() +
    '555' +
    // 9 more random digits
    Math.floor(100000000 + Math.random() * 900000000).toString();

  const authResponse = await supabase.auth.signUp({
    phone: randomTemporaryPhone,
    // we assign a random password here because we will never need it
    password: uuidv4()
  });

  if (authResponse.error) {
    throw authResponse.error;
  }

  if (!authResponse.data.user) {
    throw new Error('Could not create temporary user');
  }

  const userId = authResponse.data.user.id;

  try {
    // note: we make a new supabase client because supabase loses admin perms when we call signUp
    const adminSupabase = createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    });

    await updateProfileByUserId(adminSupabase, userId, {
      argyle_user: argyleUserId
    });
  } catch (error: unknown) {
    const errorMessage = (error as Error).message;
    if (errorMessage === 'duplicate key value violates unique constraint "argyle_user_unique"') {
      // delete the account we just made
      await supabase.auth.admin.deleteUser(userId);

      // now find the other user and log in
      const { data: findProfilesData, error: supabaseFindUserError } = await supabase
        .from('profiles')
        .select('*')
        .eq('argyle_user', argyleUserId);

      if (supabaseFindUserError) {
        throw new Error(supabaseFindUserError.message);
      }

      const userExists = findProfilesData !== null && findProfilesData.length > 0;

      // throw error if more than one user is found
      if (userExists && findProfilesData!.length > 1) {
        throw new Error('More than one user found with the same argyle user ID');
      }

      const foundProfile = findProfilesData?.[0];

      if (userExists) {
        const phone = foundProfile?.phone;
        const signInResponse = await supabase.auth.signInWithPassword({
          phone,
          password: SUPABASE_DEFAULT_PASSWORD
        });

        if (signInResponse.error) {
          console.error('Error signing in user:', signInResponse.error);
          throw new Error(signInResponse.error.message);
        }
        return signInResponse;
      }
    }
  }

  return authResponse;
};

export default createTemporaryUser;
