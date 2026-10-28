import { randomUUID } from 'crypto';
import { test, expect } from '@playwright/test';
import {
  createPlaywrightSupabaseClient,
  loginProgrammatically,
  loginProgrammaticallyWithEmail
} from './utils/playwrightSupabase';
import { ADMIN_EMAIL, ADMIN_PASSWORD, RESEARCHER_PHONE } from './seeds/rbacSeeds';

/**
 * The audit feed pages by cursor, so the links the page renders are the whole
 * mechanism — a broken href silently restarts the feed at the head instead of
 * erroring. This walks Older/Newer against seeded rows to prove the round trip.
 *
 * The rows are dated far in the future so they sit at the head of the feed no
 * matter what else the suite has written to the audit tables. `Date.now()` is
 * folded into that base so a later run also outranks rows a killed earlier run
 * left behind, its `afterAll` never having got to delete them.
 */
const BASE = Date.parse('2099-06-01T00:00:00Z') + Date.now();
const seededIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const actions = seededIds.map((_, index) => `e2e.audit.step${index}`);

// Serial: `beforeAll` runs once per worker, and under `fullyParallel` these
// tests land on different workers. Each would then import this module afresh —
// new `seededIds`, so no primary-key conflict to catch it, but the same
// `actions` at the same `at` — and seed a second copy of the feed's head. The
// shared fixtures this spec does not own are seeded in tests/globalSetup.ts,
// which is the other half of the same rule.
test.describe.serial('admin audit log', () => {
  test.beforeAll(async () => {
    const supabase = createPlaywrightSupabaseClient();
    const { data: admin } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .single();
    if (!admin) throw new Error('no seeded admin to attribute audit rows to');

    // Newest first in the feed is the reverse of this insert order.
    await supabase
      .from('admin_activity_log')
      .insert(
        seededIds.map((id, index) => ({
          id,
          admin_user_id: admin.user_id,
          admin_email: ADMIN_EMAIL,
          action: actions[index],
          created_at: new Date(BASE + (seededIds.length - index) * 1000).toISOString()
        }))
      )
      // Without this a failed seed surfaces as an unexplained assertion failure
      // three steps later instead of here.
      .throwOnError();
  });

  test.afterAll(async () => {
    const supabase = createPlaywrightSupabaseClient();
    await supabase.from('admin_activity_log').delete().in('id', seededIds);
  });

  test('admin pages through the feed with the cursor links', async ({ page }) => {
    await loginProgrammaticallyWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/audit?pageSize=2');
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();

    // Head of the feed: the two newest seeded rows, and no way further up.
    await expect(page.getByText(actions[0], { exact: true })).toBeVisible();
    await expect(page.getByText(actions[1], { exact: true })).toBeVisible();
    await expect(page.getByText(actions[2], { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Newer events' })).toHaveClass(/btn-disabled/);

    await page.getByRole('link', { name: 'Older events' }).click();
    await expect(page).toHaveURL(/before=/);

    // The next two, with nothing carried over or skipped at the boundary.
    await expect(page.getByText(actions[2], { exact: true })).toBeVisible();
    await expect(page.getByText(actions[3], { exact: true })).toBeVisible();
    await expect(page.getByText(actions[1], { exact: true })).toHaveCount(0);

    await page.getByRole('link', { name: 'Newer events' }).click();
    await expect(page).toHaveURL(/after=/);

    // Back to exactly the page we started on.
    await expect(page.getByText(actions[0], { exact: true })).toBeVisible();
    await expect(page.getByText(actions[1], { exact: true })).toBeVisible();
    await expect(page.getByText(actions[2], { exact: true })).toHaveCount(0);
  });

  test('the source filter restarts the feed instead of keeping a stale cursor', async ({
    page
  }) => {
    await loginProgrammaticallyWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/audit?pageSize=2');

    await page.getByRole('link', { name: 'Older events' }).click();
    await expect(page).toHaveURL(/before=/);

    await page.getByRole('tab', { name: 'Admin actions' }).click();
    await expect(page).toHaveURL(/source=admin/);
    await expect(page).not.toHaveURL(/before=/);
    await expect(page.getByText(actions[0], { exact: true })).toBeVisible();
  });

  test('researcher cannot open the audit log', async ({ page }) => {
    await loginProgrammatically(page, RESEARCHER_PHONE);

    const response = await page.request.get('/admin/audit', { maxRedirects: 0 });
    expect(response.status()).toBe(403);
  });
});
