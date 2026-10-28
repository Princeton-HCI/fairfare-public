/**
 * Deletes users left behind by an interrupted test run.
 *
 * The test suite no longer wipes users globally before each file (that deleted
 * fixtures belonging to whichever other file was running), so a run that is
 * killed part-way can leave rows behind. This script is the manual broom:
 *
 *   pnpm test:clean-users
 *
 * It only ever touches test identities — `@test.test` addresses and numbers in
 * the `1XXX555XXXX` test range — and refuses to run against a hosted database.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const PUB_VITE_SUPABASE_URL = process.env.PUB_VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const isTestEmail = (email: string | undefined) => !!email && email.endsWith('@test.test');
const isTestPhone = (phone: string | undefined) => !!phone && /^1\d{3}555\d{4}$/.test(phone);

const cleanTestUsers = async () => {
  if (!PUB_VITE_SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Environment variables not set.');
  }
  if (PUB_VITE_SUPABASE_URL.includes('supabase.co')) {
    throw new Error(
      'Refusing to delete users on a hosted database; this script is for local test databases only.'
    );
  }

  const supabase = createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let deleted = 0;
  let page = 1;
  const perPage = 500;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const stale = data.users.filter(
      (user) => isTestEmail(user.email) || isTestPhone(user.phone?.replace(/\D/g, ''))
    );

    for (const user of stale) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError && deleteError.message !== 'User not found') throw deleteError;
      deleted++;
    }

    // Deleting shrinks the list under us, so re-read page 1 until a sweep of it
    // finds nothing left to delete.
    if (stale.length > 0) continue;
    if (data.users.length < perPage) break;
    page++;
  }

  console.log(`Deleted ${deleted} leftover test user(s).`);
};

cleanTestUsers();
