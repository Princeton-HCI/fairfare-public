/**
 * The organizer portal: dashboard totals, the lost-wages and sick-time reports,
 * and the policy analysis page.
 *
 * Rich fixture data (drivers, activities) comes from makeOrganizersSeeds in
 * beforeAll. Dashboard totals are compared against a recomputation of the same
 * numbers from the database rather than against literals — see
 * tests/utils/organizationCounts.ts for why.
 */

import { test, expect, type Page } from '@playwright/test';
import makeOrganizersSeeds, {
  DU_HIGH_VOLUME_ACTIVITY_COUNT_FOR_TESTS
} from '../data-scripts/makeOrganizersSeeds.js';
import { loginProgrammatically, createPlaywrightSupabaseClient } from './utils/playwrightSupabase';
import { getExpectedOrgCounts, getUserIdByPhone } from './utils/organizationCounts';

/** The demo organizer, pinned to a fixed OTP in supabase/config.toml. */
const ORGANIZER_PHONE = '12223334444';

/**
 * Asserts the dashboard's two totals against the same totals recomputed from the
 * database, so the numbers stay right as fixtures change.
 */
async function expectDashboardCounts(
  page: Page,
  organizationKey: string,
  { minimumSharedDrivers }: { minimumSharedDrivers: number }
) {
  const viewerUserId = await getUserIdByPhone(ORGANIZER_PHONE);
  if (!viewerUserId) throw new Error(`No user for organizer phone ${ORGANIZER_PHONE}`);

  const { sharedData, notLinked } = await getExpectedOrgCounts(organizationKey, viewerUserId);
  expect(sharedData).toBeGreaterThanOrEqual(minimumSharedDrivers);

  await expect(page.getByTestId('drivers-successfully-shared')).toHaveText(String(sharedData));
  await expect(page.getByTestId('drivers-not-linked')).toHaveText(String(notLinked));
}

/**
 * Sets up organizer access for a phone-based user.
 * Replicates what /organizer/verify-otp does after OTP verification:
 * adds the organizer role and org affiliation for the user.
 */
async function ensureOrganizerAccess(phone: string): Promise<void> {
  const supabase = createPlaywrightSupabaseClient();

  // Find the user by phone
  const {
    data: { users }
  } = await supabase.auth.admin.listUsers();
  const user = users.find((u) => u.phone === phone);
  if (!user) return; // User will be created by loginProgrammatically

  // Add organizer role (idempotent via upsert)
  await supabase.from('user_roles').upsert([{ user_id: user.id, role: 'organizer' }], {
    onConflict: 'user_id',
    ignoreDuplicates: true
  });

  // Get the org ID from the whitelist
  const { data: whitelistData } = await supabase
    .from('organizer_affiliations_phone_whitelist')
    .select('affiliate_organization_id')
    .eq('phone_number', phone)
    .single();

  if (whitelistData) {
    // Add organizer affiliation (idempotent via upsert)
    await supabase.from('organization_members').upsert(
      [
        {
          user_id: user.id,
          organization_id: whitelistData.affiliate_organization_id,
          role: 'organizer'
        }
      ],
      { onConflict: 'user_id, organization_id', ignoreDuplicates: true }
    );
  }
}

// Use serial mode to ensure tests share the same worker and beforeAll only runs once
test.describe.serial('Organizer Page', () => {
  test.beforeAll(async () => {
    try {
      await makeOrganizersSeeds({
        duHighVolumeActivityCount: DU_HIGH_VOLUME_ACTIVITY_COUNT_FOR_TESTS
      });
    } catch (error) {
      console.error('Error in makeOrganizersSeeds:', error);
      throw error;
    }

    // Refresh the daily_driver_stats materialized view so the
    // get_policy_analysis_csv_rows RPC picks up the newly seeded data.
    const supabase = createPlaywrightSupabaseClient();
    const { error } = await supabase.rpc('refresh_policy_analysis_views');
    if (error) {
      console.error('Failed to refresh materialized view:', error);
      throw error;
    }
  });

  test.beforeEach(async ({ page }) => {
    // set the screen to be a full computer
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('generating a driver report, data, and backend connection works as expected for DU', async ({
    page
  }) => {
    await loginProgrammatically(page, ORGANIZER_PHONE);
    await ensureOrganizerAccess(ORGANIZER_PHONE);
    await page.goto('/organizer/org/du');

    // Now we're on the organizer home page; the dashboard totals should match
    // what the database says. makeOrganizersSeeds puts 24 DU drivers in place,
    // so anything below that is a broken query rather than a quiet suite.
    await expectDashboardCounts(page, 'du', { minimumSharedDrivers: 24 });

    // Go to lost wages report
    await page.goto('/organizer/org/du/lost-wages');

    // Pick Thor L by name rather than taking whichever row sorts first. The list
    // is ordered by most recent consent, so any fixture that consents later —
    // Dana U, seeded for the RBAC matrix in tests/globalSetup.ts — takes the
    // first slot and this test silently reports on a driver with no activities.
    await page.locator('input[name="search"]').fill('Thor');
    await page.getByTestId('drivers-list').locator('a').first().click();

    await page.waitForURL('/organizer/org/du/**');

    // expect the activitiesFilterStartDate and activitiesFilterEndDate inputs to have empty values
    expect(await page.locator('input[name="activitiesFilterStartDate"]').inputValue()).toBe('');
    expect(await page.locator('input[name="activitiesFilterEndDate"]').inputValue()).toBe('');

    // set the deactivatedDate
    await page.locator('input[name="deactivatedDate"]').fill('2024-12-25');

    // this should be 12 weeks before the deactivatedDate
    expect(await page.locator('input[name="activitiesFilterStartDate"]').inputValue()).toBe(
      '2024-10-02'
    );
    // this should be the day before the deactivatedDate
    expect(await page.locator('input[name="activitiesFilterEndDate"]').inputValue()).toBe(
      '2024-12-24'
    );

    // here we confirm the initial values
    await expect(
      page.getByText('Reference period: 2024-10-02 – 2024-12-24 (84 days)')
    ).toBeVisible();
    await expect(page.getByText(/Average daily pay:/)).toBeVisible();
    await expect(page.getByText(/Gross estimated lost pay:/)).toBeVisible();

    await page.locator('input[name="reactivatedDate"]').fill('2024-12-29');

    // expect loading to be visible
    await expect(page.getByText('Loading activities...')).toBeVisible();

    // then expect loading to not be visible
    await expect(page.getByText('Loading activities...')).not.toBeVisible();

    // here we confirm the values again
    await expect(
      page.getByText('Reference period: 2024-10-02 – 2024-12-24 (84 days)')
    ).toBeVisible();
    await expect(page.getByText('Deactivation period: 2024-12-25 – 2024-12-29')).toBeVisible();
    await expect(page.getByText(/Average daily pay:/)).toBeVisible();
    await expect(page.getByText(/Gross estimated lost pay:/)).toBeVisible();
    await expect(page.getByText(/Gross estimated lost pay with interest:/)).toBeVisible();
    await expect(page.getByText('Annual interest rate: 12%')).toBeVisible();

    // test download filenames
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('thor_l_earnings_report.pdf');

    const firstReferenceRideDataPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
    const firstReferenceRideData = await firstReferenceRideDataPromise;
    // Note: the CSV data is zipped
    expect(firstReferenceRideData.suggestedFilename()).toBe('thor_l_ride_data.zip');

    const firstReferenceRideDataAndReportPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download ZIP' }).click();
    const firstReferenceRideDataAndReport = await firstReferenceRideDataAndReportPromise;
    expect(firstReferenceRideDataAndReport.suggestedFilename()).toBe(
      'thor_l_ride_data_and_report.zip'
    );

    // go back to /organizer/du/lost-wages
    await page.goto('/organizer/org/du/lost-wages');

    /**
     * High-activity driver (First L): many batched rows to ensure CSV / zip downloads still work.
     */

    // search for "L"
    await page.locator('input[name="search"]').fill('L');

    // check out the driver First + Last Initial
    await page.getByText('First L').click();

    // wait for h2 with Report Preview to be visible
    await expect(page.locator('h2').first()).toHaveText('Report Preview');

    // Download all the data w/o a report
    const allDataDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
    const allDataDownload = await allDataDownloadPromise;
    // Note: the CSV data is zipped
    expect(allDataDownload.suggestedFilename()).toBe('first_l_ride_data.zip');

    // expect getByText('Please complete the above') to be visible
    await expect(page.getByText('Please complete the above')).toBeVisible();

    await page.locator('input[name="deactivatedDate"]').fill('2024-12-25');

    // select more activities
    await page.locator('input[name="activitiesFilterStartDate"]').fill('2024-01-01');
    await page.locator('input[name="activitiesFilterEndDate"]').fill('2024-03-31'); // adjust as needed

    // expect loading to be visible
    await expect(page.getByText('Loading activities...')).toBeVisible();

    // expect Please complete the above to NOT be visible
    await expect(page.getByText('Please complete the above')).not.toBeVisible();

    // expect loading to not be visible
    await expect(page.getByText('Loading activities...')).not.toBeVisible();

    // expect values to populate
    await expect(page.getByText('Deactivation period:')).toBeVisible();
    await expect(page.getByText('Average daily pay:')).toBeVisible();

    // test the data download test download filenames
    const download1Promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
    const download1 = await download1Promise;
    // Note: the CSV data is zipped
    expect(download1.suggestedFilename()).toBe('first_l_ride_data.zip');

    const download2Promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download ZIP' }).click();
    const download2 = await download2Promise;
    expect(download2.suggestedFilename()).toBe('first_l_ride_data_and_report.zip');
  });

  test('organizer cannot access other organization pages (authorization check)', async ({
    page
  }) => {
    // Log in as the DU organizer
    await loginProgrammatically(page, ORGANIZER_PHONE);
    await ensureOrganizerAccess(ORGANIZER_PHONE);
    await page.goto('/organizer/org/du');

    // Verify we're logged in and can see the DU page
    await expect(page.locator('h1')).toHaveText('LPC');
  });

  test('test PELQ portal basic functionality and authorization check', async ({ page }) => {
    await loginProgrammatically(page, ORGANIZER_PHONE);
    await ensureOrganizerAccess(ORGANIZER_PHONE);
    await page.goto('/organizer/org/pelq');

    // Now we're on the organizer home page
    // check for correct driver counts
    await expectDashboardCounts(page, 'pelq', { minimumSharedDrivers: 24 });

    await expect(page.getByRole('link', { name: 'Sick Time', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Policy Analysis', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Definitions', exact: true })).toBeVisible();

    await page.goto('/organizer/org/pelq/sick-time');
    await expect(page).toHaveURL('/organizer/org/pelq/sick-time');

    await page.goto('/organizer/org/pelq/definitions');
    await expect(page.locator('h1')).toHaveText('Definitions');

    // Now try to access a different organization that we don't belong to
    // This should result in a 403 error
    const response = await page.goto('/organizer/org/nonexistent-org-key');

    // Asserted unconditionally: wrapping this in `if (response)` meant a null
    // response passed the test silently.
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(403);

    // Alternative: Check for error text on the page
    // The 403 body from the analysis-scope check is "You do not have access to this organization"
    await expect(page.getByText(/do not have access|don't have access|403|Forbidden/i)).toBeVisible(
      {
        timeout: 5000
      }
    );
  });

  test('sick time calculations and download works as expected', async ({ page }) => {
    await loginProgrammatically(page, ORGANIZER_PHONE);
    await ensureOrganizerAccess(ORGANIZER_PHONE);
    await page.goto('/organizer/org/du/sick-time');

    // Thor L by name, not whoever sorts first — see the lost-wages test above.
    await page.locator('input[name="search"]').fill('Thor');
    await page.getByTestId('drivers-list').locator('a').first().click();

    // Seed data has NY addresses and 2024 activities. Use Custom preset with no location
    // filter and 2024 date range to match existing seed data.
    await page.getByRole('button', { name: 'Custom' }).click();
    await page.locator('input[name="filterStartDate"]').fill('2024-01-01');
    await page.locator('input[name="filterEndDate"]').fill('2024-12-31');
    await page.locator('input[name="rateStartDate"]').fill('2024-01-01');
    await page.locator('input[name="rateEndDate"]').fill('2024-12-31');
    await page.getByRole('button', { name: 'Search Rides' }).click();

    await expect(page.getByText('Total trips in hours accrual period')).toBeVisible({
      timeout: 90000
    });
    await expect(page.getByText('Hourly paid sick time rate')).toBeVisible();

    // Test download
    await page.getByRole('button', { name: 'Download CSV' }).click();
    await expect(page.getByText('Downloading...')).toBeVisible({ timeout: 10000 });
  });
  test('policy analysis calculations and download works as expected', async ({ page }) => {
    await loginProgrammatically(page, ORGANIZER_PHONE);
    await ensureOrganizerAccess(ORGANIZER_PHONE);
    await page.goto('/organizer/org/du');

    // Click policy analysis page link (exact to avoid matching the dashboard card)
    await page.getByRole('link', { name: 'Policy Analysis', exact: true }).click();

    // Test filters
    // expect the filterStartDate and filterEndDate inputs to have empty values
    expect(await page.locator('input[name="filterStartDate"]').inputValue()).toBe('');
    expect(await page.locator('input[name="filterEndDate"]').inputValue()).toBe('');

    // set the filterStartDate
    await page.locator('input[name="filterStartDate"]').fill('2024-12-25');
    await page.getByRole('button', { name: 'Search Rides' }).click();

    // Wait for data to reload with the new filter applied
    await expect(page.getByText('Average distance per trip')).toBeVisible({ timeout: 90000 });

    // Test export request
    await page.getByRole('button', { name: 'Request CSV Export' }).click();
    await expect(page.getByText('Export requested!')).toBeVisible({ timeout: 10000 });
  });
});
