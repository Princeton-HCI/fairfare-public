import { test, expect } from '@playwright/test';

test.describe('Coming from a survey with a survey_response_id', () => {
  test('Loads the landing screen as expected', async ({ page }) => {
    await page.goto('/driver/studies/edl/argyle?survey_response_id=test-the-landing-screen');
    // wait 4 seconds for the page to load

    expect(await page.locator('h1').textContent()).toBe(
      'You might get a warning about your account—but don’t worry'
    );

    expect(await page.locator('p').nth(1).textContent()).toContain(
      'Your credentials are only used to access your gig work data'
    );
  });
});

test.describe('Arriving without a survey_response_id', () => {
  test('Shows an error', async ({ page }) => {
    await page.goto('/driver/studies/edl/argyle');

    expect(await page.locator('h1').textContent()).toBe('Something went wrong on our end.');

    expect(await page.locator('p').nth(1).textContent()).toContain(
      'Error message: A survey_response_id is required in the request URL. You must complete the survey before continuing in this study.'
    );
  });
});

test.describe('Arriving with an invalid post_sync value', () => {
  test('Shows an error', async ({ page }) => {
    await page.goto(
      '/driver/studies/edl/argyle?survey_response_id=test-the-landing-screen&post_sync=invalid'
    );

    expect(await page.locator('h1').textContent()).toBe('Something went wrong on our end.');

    expect(await page.locator('p').nth(0).textContent()).toContain(
      "We're working to fix the issue."
    );
  });
});

test.describe('Arriving with a valid post_sync value, survey_response_id, and platforms', () => {
  test('Loads the landing screen as expected', async ({ page }, testInfo) => {
    await page.goto(
      '/driver/studies/edl/argyle?survey_response_id=test-the-landing-screen&post_sync=do-nothing&platforms=uber,lyft'
    );

    expect(await page.locator('h1').textContent()).toBe(
      'You might get a warning about your account—but don’t worry'
    );

    // take a screenshot -- this test has been flaky, could help debug
    const landing = await page.screenshot();
    testInfo.attach('Landing', {
      body: landing,
      contentType: 'image/png'
    });

    expect(
      await page
        .locator(
          "img[alt=\"A notification from Uber with the text 'Did you just login? We've detected a new device login on your account. Please contact support if ...'\"]"
        )
        .count()
    ).toBe(1);
  });
});
