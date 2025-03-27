import { test, expect } from '@playwright/test';
test.describe('Signing up for a specific (e.g., EDL) study', () => {
  test('Redirecting from the study survey', async ({ page }) => {
    await page.goto('/driver/studies/edl/argyle?survey_response_id=ci-test');

    // Expect to see "Preparing to connect your data..."
    expect(await page.getByText('Preparing to connect your data...')).not.toBeNull();

    /* Argyle link */
    // TODO: enable this part in the CI test!
    // TODO: continue the rest of the Argyle flow here using a test account here!
    // await page.getByRole('button', { name: 'Uber Driver Gig platform' }).click();

    // select Email
    // await page.getByRole('button', { name: 'Email' }).click();

    // expect to see "Log in to Uber Driver"
    // expect(await page.getByText('Log in to Uber Driver')).not.toBeNull();
  });

  test('Landing on the page without a survey response ID', async ({ page }) => {
    await page.goto('/driver/studies/edl/argyle');

    await expect(
      page.getByText('You must complete the survey before continuing in this study')
    ).toBeVisible();
  });
});
