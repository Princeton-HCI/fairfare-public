/**
 * Note that this file name starts with 1_ instead of 0_, since it should be
 * run after the test files that don't rely on the organizer seeds.
 */

import { test, expect } from '@playwright/test';
import makeOrganizersSeeds from '../data-migrations/makeOrganizersSeeds.js';

test.describe('Organizer Page', () => {
  test.beforeAll(async () => {
    await makeOrganizersSeeds();
  });

  test('generating a driver report works as expected', async ({ page }) => {
    await page.goto('/organizer/org/lpc');

    // Log in
    await page.locator('input[name="signupCode"]').fill('secret');
    await page.locator('input[name="phoneNumber"]').fill('12223334444');
    await page.getByRole('button', { name: 'Submit' }).click();

    // wait until the OTP input is visible
    await page.waitForSelector('input[name="token"]');
    await page.locator('input[name="token"]').fill('555555');
    await page.getByRole('button', { name: 'Verify' }).click();

    // Now we're on the organizer home page
    // click the first child of data-testid="drivers-list"
    await page.getByTestId('drivers-list').locator('a').first().click();

    await page.waitForURL('/organizer/org/lpc/**');

    // expect the activitiesFilterStartDate and activitiesFilterEndDate inputs to have empty values
    expect(await page.locator('input[name="activitiesFilterStartDate"]').inputValue()).toBe('');
    expect(await page.locator('input[name="activitiesFilterEndDate"]').inputValue()).toBe('');

    // get recent dates formatted like YYYY-MM-DD
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fourDaysAgoFormatted = fourDaysAgo.toISOString().split('T')[0];

    // twoDaysAgo
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoFormatted = twoDaysAgo.toISOString().split('T')[0];

    // set the deactivatedDate
    await page.locator('input[name="deactivatedDate"]').fill(fourDaysAgoFormatted);

    const twelveWeeksBeforeDeactivation = new Date(fourDaysAgo);
    twelveWeeksBeforeDeactivation.setDate(twelveWeeksBeforeDeactivation.getDate() - 85);
    const twelveWeeksBeforeDeactivationFormatted = twelveWeeksBeforeDeactivation
      .toISOString()
      .split('T')[0];

    const oneDayBeforeDeactivation = new Date(fourDaysAgo);
    oneDayBeforeDeactivation.setDate(oneDayBeforeDeactivation.getDate() - 1);
    const oneDayBeforeDeactivationFormatted = oneDayBeforeDeactivation.toISOString().split('T')[0];

    // expect the activitiesFilterStartDate and activitiesFilterEndDate inputs to be updated
    expect(await page.locator('input[name="activitiesFilterStartDate"]').inputValue()).toBe(
      twelveWeeksBeforeDeactivationFormatted
    );
    expect(await page.locator('input[name="activitiesFilterEndDate"]').inputValue()).toBe(
      oneDayBeforeDeactivationFormatted
    );

    await page.locator('input[name="reactivatedDate"]').fill(twoDaysAgoFormatted);

    // test download filenames
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('john_smith_deactivation_report.pdf');

    const download1Promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const download1 = await download1Promise;
    expect(download1.suggestedFilename()).toBe('john_smith_ride_data.csv');

    const download2Promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download ZIP' }).click();
    const download2 = await download2Promise;
    expect(download2.suggestedFilename()).toBe('john_smith_ride_data.zip');

    // Test breadcrumb link
    await page.getByRole('link', { name: 'All Drivers' }).click();
    // expect to be back at /organizer/lpc
    await page.waitForURL('/organizer/org/lpc');
    expect(page.url()).toMatch(/.*\/organizer\/org\/lpc$/);
  });
});
