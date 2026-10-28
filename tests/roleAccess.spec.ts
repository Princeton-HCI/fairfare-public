import { randomUUID } from 'crypto';
import { test, expect, type Page } from '@playwright/test';
import {
  loginProgrammatically,
  loginProgrammaticallyWithEmail,
  createPlaywrightSupabaseClient
} from './utils/playwrightSupabase';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DRIVER_PHONE,
  RESEARCHER_PHONE,
  SEED_PHONE,
  ensureOrg
} from './seeds/rbacSeeds';

async function statusWithoutFollow(page: Page, path: string) {
  return page.request.get(path, { maxRedirects: 0 });
}

// Users, roles, organizations and consents come from tests/seeds/rbacSeeds.ts,
// seeded once per process by tests/globalSetup.ts.
test.describe('RBAC matrix', () => {
  test.setTimeout(60_000);

  test('lead organizer can open Team and invite; organizer cannot open Settings on PELQ or scope=all', async ({
    page
  }) => {
    await loginProgrammatically(page, SEED_PHONE);

    await page.goto('/organizer/org/du/team');
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();

    const invitePhone = `1555${Date.now().toString().slice(-7)}`;
    await page.getByLabel('Phone number').fill(invitePhone);
    await page.getByRole('button', { name: 'Invite' }).click();
    await expect(page.getByText('Invite sent')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Pending invites' })).toBeVisible();
    await expect(page.getByText('Invited').first()).toBeVisible();

    const du = await ensureOrg('du', 'LPC');
    const supabase = createPlaywrightSupabaseClient();
    const { data: whitelist } = await supabase
      .from('organizer_affiliations_phone_whitelist')
      .select('phone_number')
      .eq('affiliate_organization_id', du!.id)
      .eq('phone_number', invitePhone)
      .maybeSingle();
    expect(whitelist?.phone_number).toBe(invitePhone);

    const settings = await statusWithoutFollow(page, '/organizer/org/pelq/argyle-settings');
    expect(settings.status()).toBe(403);

    const teamOnPelq = await statusWithoutFollow(page, '/organizer/org/pelq/team');
    expect(teamOnPelq.status()).toBe(403);

    const allScope = await statusWithoutFollow(
      page,
      '/api/organizer/policy_analysis_stats?selectedScope=all'
    );
    expect(allScope.status()).toBe(403);
  });

  test('only an organizer administrator can remove a driver from the organization', async ({
    page
  }) => {
    await loginProgrammatically(page, SEED_PHONE);
    const driverUserId = randomUUID();

    // Plain organizer on PELQ: the capability check fails before any lookup.
    const asOrganizer = await page.request.post('/api/organizer/deaffiliate-driver', {
      data: { driverUserId, organizationKey: 'pelq' }
    });
    expect(asOrganizer.status()).toBe(403);

    // Lead organizer on DU: passes the capability check, then 404s on the fake driver.
    const asLead = await page.request.post('/api/organizer/deaffiliate-driver', {
      data: { driverUserId, organizationKey: 'du' }
    });
    expect(asLead.status()).toBe(404);
  });

  test('researcher reads every org dashboard and the admin area, but cannot export or manage', async ({
    page
  }) => {
    await loginProgrammatically(page, RESEARCHER_PHONE);

    // Organization dashboards open without a membership.
    await page.goto('/organizer/org/du');
    await expect(page.getByRole('heading', { name: 'LPC' })).toBeVisible();
    expect((await statusWithoutFollow(page, '/organizer/org/pelq')).status()).toBe(200);
    expect((await statusWithoutFollow(page, '/organizer/org/du/lost-wages')).status()).toBe(200);
    expect((await statusWithoutFollow(page, '/organizer/org/du/policy-analysis')).status()).toBe(
      200
    );

    // ...except settings and team.
    expect((await statusWithoutFollow(page, '/organizer/org/du/argyle-settings')).status()).toBe(
      403
    );
    expect((await statusWithoutFollow(page, '/organizer/org/du/team')).status()).toBe(403);

    // Aggregates are fine; downloads of individual data are not.
    expect(
      (await page.request.get('/api/organizer/policy_analysis_stats?selectedScope=all')).status()
    ).toBe(200);
    expect(
      (await page.request.get('/api/organizer/policy_analysis_stats?selectedScope=du')).status()
    ).toBe(200);
    expect(
      (
        await page.request.get(
          `/api/organizer/download_sick_time_csv?selectedScope=du&driverUserId=${randomUUID()}`
        )
      ).status()
    ).toBe(403);
    expect(
      (
        await page.request.get('/api/organizer/download_policy_analysis_csv?selectedScope=du')
      ).status()
    ).toBe(403);
    expect(
      (
        await page.request.post('/api/organizer/request_policy_analysis_export', {
          data: { selectedScope: 'du' }
        })
      ).status()
    ).toBe(403);
    expect(
      (
        await page.request.post('/api/organizer/deaffiliate-driver', {
          data: { driverUserId: randomUUID(), organizationKey: 'du' }
        })
      ).status()
    ).toBe(403);

    // Download controls are hidden on the policy analysis page.
    await page.goto('/organizer/org/du/policy-analysis');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /export|download/i })).toHaveCount(0);

    // Admin area is readable, mutations are refused.
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
    expect((await statusWithoutFollow(page, '/admin/drivers')).status()).toBe(200);
    expect((await statusWithoutFollow(page, '/admin/organizations/du')).status()).toBe(200);
    expect((await statusWithoutFollow(page, '/admin/platform-users')).status()).toBe(200);
    await page.goto('/admin/organizations/du');
    await expect(page.getByRole('button', { name: /soft-delete/i })).toHaveCount(0);
    expect(
      (
        await page.request.post('/api/admin/organizations', {
          data: { name: 'Nope', key: 'nope-researcher' }
        })
      ).status()
    ).toBe(403);
    expect(
      (
        await page.request.post('/api/admin/drivers/deactivate', {
          data: { driverUserId: randomUUID(), organizationKey: 'du' }
        })
      ).status()
    ).toBe(403);
    // Granting themselves the admin role is the escalation this has to refuse.
    expect(
      (
        await page.request.post('/api/admin/platform-users', {
          data: { email: 'nope-researcher@test.test', password: 'password-123', role: 'admin' }
        })
      ).status()
    ).toBe(403);
    expect(
      (
        await page.request.fetch('/api/admin/platform-users', {
          method: 'PATCH',
          data: { userId: randomUUID(), role: 'admin' }
        })
      ).status()
    ).toBe(403);

    // The research aggregates page is retired; even the role it was built for
    // gets a 404 now.
    expect((await statusWithoutFollow(page, '/research')).status()).toBe(404);
    expect((await statusWithoutFollow(page, '/admin/research')).status()).toBe(404);
  });

  test('driver is blocked from organizer, admin, and research', async ({ page }) => {
    await loginProgrammatically(page, DRIVER_PHONE);

    expect((await statusWithoutFollow(page, '/organizer/org/du')).status()).toBe(403);
    expect((await statusWithoutFollow(page, '/research')).status()).toBe(403);
    expect((await statusWithoutFollow(page, '/admin')).status()).toBe(403);
  });

  test('admin reaches /admin, whitelists an organizer administrator, and manages platform users', async ({
    page
  }) => {
    await loginProgrammaticallyWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();

    const supabase = createPlaywrightSupabaseClient();
    const du = await ensureOrg('du', 'LPC');

    // Whitelist a phone as an organizer administrator.
    const leadPhone = `1556${Date.now().toString().slice(-7)}`;
    const whitelistRes = await page.request.post('/api/admin/organizers/whitelist', {
      data: { phoneNumber: `+${leadPhone}`, organizationId: du.id, role: 'lead_organizer' }
    });
    expect(whitelistRes.status()).toBe(200);
    const { data: whitelistRow } = await supabase
      .from('organizer_affiliations_phone_whitelist')
      .select('invited_role')
      .eq('affiliate_organization_id', du.id)
      .eq('phone_number', leadPhone)
      .single();
    expect(whitelistRow?.invited_role).toBe('lead_organizer');
    await supabase
      .from('organizer_affiliations_phone_whitelist')
      .delete()
      .eq('affiliate_organization_id', du.id)
      .eq('phone_number', leadPhone);

    // Add a researcher by email; the account is created on the spot.
    const researcherEmail = `ff-researcher-${Date.now()}@test.test`;
    const researcherPassword = 'researcher-password-1';
    const researcherRes = await page.request.post('/api/admin/platform-users', {
      data: { email: researcherEmail, password: researcherPassword }
    });
    expect(researcherRes.status()).toBe(200);
    const { userId, created } = (await researcherRes.json()) as {
      userId: string;
      created: boolean;
    };
    expect(created).toBe(true);
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    expect(roleRow?.role).toBe('researcher');

    // Those credentials work at the admin login, which is the researcher's only
    // way in now.
    const researcherLogin = await page.request.post('/admin/login', {
      data: { email: researcherEmail, password: researcherPassword }
    });
    expect(researcherLogin.status()).toBe(200);

    // Re-submitting the same email resets the password instead of failing.
    const newPassword = 'researcher-password-2';
    const resetRes = await page.request.post('/api/admin/platform-users', {
      data: { email: researcherEmail, password: newPassword }
    });
    expect(resetRes.status()).toBe(200);
    expect((await resetRes.json()) as { userId: string; created: boolean }).toMatchObject({
      userId,
      created: false
    });
    expect(
      (
        await page.request.post('/admin/login', {
          data: { email: researcherEmail, password: newPassword }
        })
      ).status()
    ).toBe(200);
    expect(
      (
        await page.request.post('/admin/login', {
          data: { email: researcherEmail, password: researcherPassword }
        })
      ).status()
    ).toBe(401);

    // A password that cannot be typed into the form is refused server-side too.
    const shortPasswordRes = await page.request.post('/api/admin/platform-users', {
      data: { email: `ff-researcher-short-${Date.now()}@test.test`, password: 'short' }
    });
    expect(shortPasswordRes.status()).toBe(400);

    // Promote them to admin and back. The role change never touches
    // credentials, so the password set above still works afterwards.
    const promoteRes = await page.request.fetch('/api/admin/platform-users', {
      method: 'PATCH',
      data: { userId, role: 'admin' }
    });
    expect(promoteRes.status()).toBe(200);
    const { data: promoted } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    expect(promoted?.role).toBe('admin');
    expect(
      (
        await page.request.post('/admin/login', {
          data: { email: researcherEmail, password: newPassword }
        })
      ).status()
    ).toBe(200);

    const demoteRes = await page.request.fetch('/api/admin/platform-users', {
      method: 'PATCH',
      data: { userId, role: 'researcher' }
    });
    expect(demoteRes.status()).toBe(200);

    await page.goto('/admin/platform-users');
    await expect(page.getByRole('heading', { name: 'Platform users', level: 1 })).toBeVisible();
    await expect(page.getByText('Add platform user')).toBeVisible();
    // The email shows twice on the row: as the display name (no profile name
    // yet) and in the Email column.
    await expect(page.getByText(researcherEmail).first()).toBeVisible();

    await supabase.auth.admin.deleteUser(userId);
  });

  test('unauthenticated users cannot open admin or research', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);

    const research = await statusWithoutFollow(page, '/research');
    expect([302, 303, 307]).toContain(research.status());
  });
});
