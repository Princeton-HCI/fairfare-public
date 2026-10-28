import { test, expect } from '@playwright/test';
import { createPlaywrightSupabaseClient, loginProgrammatically } from './utils/playwrightSupabase';
import { getUserIdByPhone } from './utils/organizationCounts';

/**
 * A driver of this spec's own. Sharing 18009000020 with the landing and study
 * specs meant their affiliations decided which screen this flow landed on —
 * with a study affiliation already in place the consent page offers "Update"
 * rather than "Link my Uber/Lyft account". The number needs no pinned OTP
 * because this spec signs in with `loginProgrammatically`.
 */
const TEST_PHONE = '15550140001';
/** Not DU or PELQ — see comment in the test below. */
const TEST_ORG_KEY = 'opl';

/**
 * Puts this spec's driver back to having no affiliations or consents at all.
 *
 * Run before the test as well as after it. The last click in the test kicks off
 * a server write, so cleanup afterwards can race it and lose: the row lands
 * after the delete, and the *next* run opens the page to "You're already
 * sharing data with…" and no radio buttons to assert on.
 */
async function clearDriverOrgState() {
  const supabase = createPlaywrightSupabaseClient();

  const userId = await getUserIdByPhone(TEST_PHONE);
  if (!userId) return;

  // Every row, not just the test organization's: the screen this flow lands on
  // depends on whether the driver is affiliated with anything at all.
  await supabase.from('driver_affiliate_organization_affiliations').delete().eq('user_id', userId);
  await supabase
    .from('driver_affiliate_organization_data_sharing_consents')
    .delete()
    .eq('user_id', userId);

  // And the linked account the previous run's final click created: with one in
  // place the consent page offers "Update" instead of "Link my Uber/Lyft
  // account", so leaving it behind breaks the *next* run rather than this one.
  await supabase.from('argyle_accounts').delete().eq('user_id', userId);
}

test.describe('Signing up for the study', () => {
  test.beforeEach(clearDriverOrgState);
  test.afterEach(clearDriverOrgState);

  // FIXME: update title once the argyle portion is complete, e.g.,
  // closing the argyle link window works as expected
  test('Sign up and affiliation/data sharing preference persistence work as expected', async ({
    page
  }) => {
    await loginProgrammatically(page, TEST_PHONE);
    await page.goto('/driver/org');

    // OPL keeps this flow clear of the organizations the organizer portal spec
    // reports on. Those counts are derived from the database now, so this is no
    // longer load-bearing — it just keeps the two specs from racing each other
    // on the same rows.
    await page.locator(`label[for="${TEST_ORG_KEY}"]`).click();

    // reload and confirm this is still selected
    await page.reload();

    // Wait for radios to load from DB before checking selection state
    await page
      .locator('input[type="radio"][name="affiliation"]')
      .first()
      .waitFor({ state: 'attached' });

    // Give the selected-affiliation DB query time to resolve and update checked state
    await expect(page.locator(`input[type="radio"]#${TEST_ORG_KEY}`)).toBeChecked({
      timeout: 5000
    });

    await page.getByRole('link', { name: 'Continue' }).click();

    /** Data sharing screen **/
    await page.waitForURL(`**/driver/org-data-sharing/${TEST_ORG_KEY}`);

    const shareRadio = page.getByRole('radio', { name: 'Share', exact: true });
    await expect(shareRadio).not.toBeChecked();
    await expect(page.getByRole('radio', { name: 'Do not share', exact: true })).not.toBeChecked();

    const linkAccountButton = page.getByRole('button', { name: 'Link my Uber/Lyft account' });
    await expect(linkAccountButton).toBeDisabled();

    const shareLabel = page.locator('label', { has: page.locator('#shareConsent') });
    await shareLabel.scrollIntoViewIfNeeded();
    await shareLabel.click();
    await expect(shareRadio).toBeChecked();
    await expect(linkAccountButton).toBeEnabled();

    await linkAccountButton.click();

    /** Argyle page **/
    // await page.waitForURL('**/driver/argyle');

    // sleep for 5s to allow the argyle page to load
    // await page.waitForTimeout(5000);

    /* Argyle link */
    // TODO: enable this part in the CI test!
    // await page.getByRole('button', { name: 'Uber Driver Gig platform' }).click();

    // close the argyle link
    // await page.getByLabel('Close', { exact: true }).click();

    // // get redirected back to consent
    // await page.waitForURL('/driver/consent');

    // // confirm toast popped
    // await page
    //   .getByRole('alert')
    //   .locator('div')
    //   .filter({ hasText: 'You exited out of linking your Uber/Lyft account.' })
    //   .click();
  });
});
