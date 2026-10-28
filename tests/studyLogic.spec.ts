import { test, expect } from '@playwright/test';

import { loginProgrammatically } from './utils/playwrightSupabase';

/**
 * These tests verify study page logic (not the login flow).
 * We use loginProgrammatically to set session cookies directly,
 * avoiding Supabase Auth's 60-second per-phone OTP cooldown
 * that causes flaky failures when phone numbers are reused across tests.
 *
 * The real OTP login flow is already covered by tests/driverLanding.spec.ts.
 */

test.describe('Coming from a survey with a survey_response_id', () => {
  test('Loads the landing screen as expected', async ({ page }) => {
    await loginProgrammatically(page, '18009000020');

    await page.goto('/driver/studies/rtk/argyle?survey_response_id=test-the-landing-screen');

    // EDL and rtk have been removed, leaving no active studies, so
    // the route lands on the not-found page (see ENG-344). Asserted on that one
    // page rather than on `getByText('Study not found').or(…)`, which passed for
    // whichever of two pages happened to render — and would keep passing if the
    // study came back and rendered the wrong one.
    await expect(
      page.getByRole('heading', { name: "Oops! This page doesn't exist." })
    ).toBeVisible();
  });
});

test.describe('Arriving without a survey_response_id', () => {
  test('Shows an error', async ({ page }) => {
    await loginProgrammatically(page, '18009000030');

    await page.goto('/driver/studies/rtk/argyle');

    // TODO: make this so the error shows without having to log in
    await expect(
      page.getByRole('heading', { name: 'Something went wrong on our end.' })
    ).toBeVisible();

    await expect(
      page.getByText(
        'Error message: A survey_response_id is required in the request URL. You must complete the survey before continuing in this study.'
      )
    ).toBeVisible();
  });
});

test.describe('Arriving with an invalid post_sync value', () => {
  test('Shows invalid post_sync error', async ({ page }) => {
    await loginProgrammatically(page, '18009000020');

    await page.goto(
      '/driver/studies/rtk/argyle?survey_response_id=test-the-landing-screen&post_sync=invalid'
    );

    await expect(
      page.getByRole('heading', { name: 'Something went wrong on our end.' })
    ).toBeVisible();
    await expect(page.getByText('Error message: Invalid post_sync value')).toBeVisible();
  });
});

test.describe('Arriving with a valid post_sync value, survey_response_id, and platforms', () => {
  test('Loads the landing screen as expected', async ({ page }) => {
    await loginProgrammatically(page, '18009000010');

    // As above: no active studies, so this lands on the not-found page (ENG-344).
    await page.goto(
      '/driver/studies/rtk/argyle?survey_response_id=test-the-landing-screen&post_sync=do-nothing&platforms=uber,lyft'
    );
    await expect(
      page.getByRole('heading', { name: "Oops! This page doesn't exist." })
    ).toBeVisible();
  });
});
