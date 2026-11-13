/**
 * Provision a platform-admin login (email + password).
 *
 * Creates the auth user's credentials and writes `user_roles.role = 'admin'`
 * so they can sign in at /admin/login.
 *
 * Usage:
 *   pnpm seed:admins <email> <password>
 *   npx tsx data-scripts/makeAdminUser.ts admin@getsystem.org 'a-strong-password'
 *
 * Idempotent: an existing user has their password reset to the provided value.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const PUB_VITE_SUPABASE_URL = process.env.PUB_VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!PUB_VITE_SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing PUB_VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function findUserId(email: string): Promise<string | null> {
  // Page through users (dev volumes are small); match case-insensitively.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function main() {
  const [emailArg, password] = process.argv.slice(2);
  const email = (emailArg ?? '').trim().toLowerCase();

  if (!email && !password) {
    const fromEnv = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((value) => value.length > 0);
    if (fromEnv.length === 0) {
      console.error('Usage: pnpm seed:admins <email> <password>');
      console.error('Or set ADMIN_EMAILS to backfill existing users with the admin role.');
      process.exit(1);
    }
    for (const envEmail of fromEnv) {
      const id = await findUserId(envEmail);
      if (!id) {
        console.warn(`Skipping ${envEmail}: no auth user found`);
        continue;
      }
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ user_id: id, role: 'admin' }, { onConflict: 'user_id' });
      if (roleError) throw roleError;
      console.log(`✓ Granted admin role to ${envEmail}`);
    }
    return;
  }

  if (!email || !password) {
    console.error('Usage: pnpm seed:admins <email> <password>');
    process.exit(1);
  }

  let userId = await findUserId(email);
  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true
    });
    if (error) throw error;
    console.log(`✓ Updated password for existing user: ${email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (error || !data.user) throw error ?? new Error('Failed to create user');
    userId = data.user.id;
    console.log(`✓ Created user: ${email}`);
  }

  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id' });
  if (roleError) throw roleError;
  console.log(`✓ Granted admin role to ${email}`);

  console.log(`\nDone. Log in at /admin/login.`);
}

main().catch((err) => {
  console.error('Failed to seed admin user:', err);
  process.exit(1);
});
