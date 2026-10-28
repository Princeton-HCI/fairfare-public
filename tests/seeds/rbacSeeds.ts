/**
 * Fixtures for the RBAC matrix tests (tests/roleAccess.spec.ts).
 *
 * These live outside the spec because they are *global* state: fixed phone
 * numbers, a fixed admin email, and two organizations, all shared by every test
 * in the matrix. Seeding them from a `beforeAll` ran the whole block once per
 * Playwright worker, and with `fullyParallel` the workers collided — two
 * concurrent `auth.admin.createUser` calls for the same phone make the loser
 * fail with a 500 "Database error creating new user" (a sequential duplicate is
 * a clean 422 `phone_exists`), which failed the test and skipped its siblings.
 *
 * `tests/globalSetup.ts` runs this once per Playwright process, before any
 * worker starts, so the seeding is single-threaded by construction.
 */

import { randomUUID } from 'crypto';
import type { PlatformRole } from '@src/lib/rbac';
import { createPlaywrightSupabaseClient } from '../utils/playwrightSupabase';

export const SEED_PHONE = '15550130000';
export const RESEARCHER_PHONE = '15550130001';
export const DRIVER_PHONE = '15550130002';
export const DU_DRIVER_PHONE = '15550130003';
export const ADMIN_EMAIL = 'ff48-admin@test.test';
export const ADMIN_PASSWORD = 'ff48-admin-password';

async function findUserByPhone(phone: string) {
  const supabase = createPlaywrightSupabaseClient();
  let page = 1;
  const perPage = 500;
  while (true) {
    const {
      data: { users }
    } = await supabase.auth.admin.listUsers({ page, perPage });
    const match = users.find(
      (user) => user.phone === phone || user.phone?.replace(/\D/g, '') === phone
    );
    if (match) return match;
    if (users.length < perPage) return null;
    page++;
  }
}

/**
 * Idempotent: a local database keeps its users between runs, so every helper
 * here adopts what is already there instead of assuming a clean slate.
 */
export async function ensureOrg(key: string, name: string) {
  const supabase = createPlaywrightSupabaseClient();
  const { data: existing } = await supabase
    .from('affiliate_organizations')
    .select('id, key')
    .eq('key', key)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('affiliate_organizations')
    .upsert({ key, name, status: 'active' }, { onConflict: 'key' })
    .select('id, key')
    .single();
  if (error || !data) throw error ?? new Error(`Failed to create organization ${key}`);
  return data;
}

async function ensurePhoneUser(params: { phone: string; platformRole?: PlatformRole }) {
  const supabase = createPlaywrightSupabaseClient();
  const existing = await findUserByPhone(params.phone);
  const password = `test-pw-${params.phone}`;

  let userId = existing?.id;
  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      phone: params.phone,
      phone_confirm: true,
      password
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error(`Failed to create user ${params.phone}`);
    }
    userId = created.data.user.id;
  }

  // The profile is created by an after-insert trigger on auth.users, so it can
  // lag the create call by a moment.
  let profile: { user_id: string } | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      profile = data;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (!profile) {
    const { error: insertError } = await supabase.from('profiles').upsert(
      {
        user_id: userId,
        phone: params.phone,
        argyle_user: randomUUID()
      },
      { onConflict: 'user_id' }
    );
    if (insertError) throw insertError;
  }

  if (params.platformRole) {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: params.platformRole }, { onConflict: 'user_id' });
    if (error) throw error;
  }

  return userId;
}

async function ensureSeedRoles() {
  const supabase = createPlaywrightSupabaseClient();
  const seedUserId = await ensurePhoneUser({ phone: SEED_PHONE, platformRole: 'organizer' });

  const du = await ensureOrg('du', 'LPC');
  const pelq = await ensureOrg('pelq', 'PELQ');

  const { error: membershipError } = await supabase.from('organization_members').upsert(
    [
      { user_id: seedUserId, organization_id: du.id, role: 'lead_organizer' },
      { user_id: seedUserId, organization_id: pelq.id, role: 'organizer' }
    ],
    { onConflict: 'user_id, organization_id' }
  );
  if (membershipError) throw membershipError;
}

async function ensureAdminUser() {
  const supabase = createPlaywrightSupabaseClient();
  const created = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true
  });

  let userId = created.data.user?.id;
  if (created.error || !userId) {
    let page = 1;
    const perPage = 500;
    while (!userId) {
      const {
        data: { users }
      } = await supabase.auth.admin.listUsers({ page, perPage });
      userId = users.find((user) => user.email === ADMIN_EMAIL)?.id;
      if (userId || users.length < perPage) break;
      page++;
    }
    if (!userId) throw created.error ?? new Error('Failed to create admin user');
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true
    });
    if (error) throw error;
  }

  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id' });
  if (error) throw error;
}

/**
 * The org-scoped analysis endpoints 404 when an organization has no drivers
 * with a complete profile, so the scope assertions need one driver who shares
 * data with DU. Activities are not needed: the stats come back as zeros.
 */
async function ensureConsentingDuDriver() {
  const supabase = createPlaywrightSupabaseClient();
  const userId = await ensurePhoneUser({ phone: DU_DRIVER_PHONE, platformRole: 'driver' });
  const du = await ensureOrg('du', 'LPC');

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ first_name: 'Dana', last_initial: 'U', phone: DU_DRIVER_PHONE })
    .eq('user_id', userId);
  if (profileError) throw profileError;

  const { error: consentError } = await supabase
    .from('driver_affiliate_organization_data_sharing_consents')
    .upsert(
      { user_id: userId, affiliate_organization_id: du.id },
      { onConflict: 'user_id, affiliate_organization_id' }
    );
  if (consentError) throw consentError;

  // The organizer dashboard derives "did not link an account" as
  // affiliations - profiles, so a driver with a consent but no affiliation row
  // silently skews both tiles. Seed the affiliation too, the way a real signup
  // would, so the org totals stay coherent for tests/organizerPortal.spec.ts.
  const { error: affiliationError } = await supabase
    .from('driver_affiliate_organization_affiliations')
    .upsert(
      { user_id: userId, affiliate_organization_id: du.id, is_primary: true },
      { onConflict: 'user_id, affiliate_organization_id' }
    );
  if (affiliationError) throw affiliationError;

  return userId;
}

/** Seeds every user, role, organization and consent the RBAC matrix expects. */
export async function seedRbacFixtures() {
  await ensureSeedRoles();
  await ensurePhoneUser({ phone: RESEARCHER_PHONE, platformRole: 'researcher' });
  await ensurePhoneUser({ phone: DRIVER_PHONE, platformRole: 'driver' });
  await ensureConsentingDuDriver();
  await ensureAdminUser();
}
