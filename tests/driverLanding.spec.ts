import { test, expect } from '@playwright/test';

test.describe('Driver Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/driver');
    await page.waitForURL('**/driver/landing');
  });

  test('should redirect to driver/landing if not logged in', async ({ page }) => {
    // Check if the page is redirected to driver/landing
    await page.waitForURL('**/driver/landing');
    expect(page.url()).toContain('/driver/landing');
  });

  test('should display main elements', async ({ page }) => {
    // Check for the hero text
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'How much is Uber taking from your fares?'
    );

    // A locator is never null, so `expect(locator).not.toBeNull()` passed
    // whether or not the element was on the page. Assert visibility instead.
    await expect(page.getByRole('link', { name: 'Join Our Study' })).toBeVisible();
    await expect(page.locator('footer').getByRole('link', { name: 'Learn more' })).toBeVisible();
  });

  test('should navigate to the login screen after clicking "Join the study" and be able to log in and see the affiliations page', async ({
    page
  }) => {
    // Click the "Join the study" button
    await page.getByRole('link', { name: 'Join Our Study' }).click();

    await expect(page.getByRole('heading', { name: 'Log in or sign up' })).toBeVisible();

    // fill phone number
    await page.getByRole('textbox', { name: 'Enter your phone number' }).fill('8009000020');

    // click continue button
    await page.getByRole('button', { name: 'Submit' }).click();

    // expect to see the OTP input
    await page.getByRole('spinbutton', { name: 'One time passcode Format: 222333' }).fill('808282');

    // click submit button
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page.getByRole('heading', { name: 'Your affiliation' })).toBeVisible();
  });
});

test.describe('Driver Landing Page with org parameter', () => {
  test('should redirect to the org data sharing page after logging in', async ({ page }) => {
    await page.goto('/driver/landing?org=du');
    await page.getByRole('link', { name: 'Join Our Study' }).click();

    // Log in
    await page.getByRole('textbox', { name: 'Enter your phone number' }).fill('800 900 0010');
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByRole('spinbutton', { name: 'One time passcode Format:' }).fill('808181');
    await page.getByRole('button', { name: 'Verify' }).click();

    // expect to see the org data sharing page (custom to DU)
    await expect(page.locator('body')).toContainText(
      'LPC controls shared data, researchers cannot influence its use or handling.'
    );
    await expect(page.getByRole('group', { name: 'Choose if you would like to' })).toBeVisible();

    await expect(page.locator('#shareConsent')).not.toBeChecked();
    await expect(page.locator('#doNotShareConsent')).not.toBeChecked();
  });
});

test.describe('Landing Page footer', () => {
  test('should display the support email', async ({ page }) => {
    await page.goto('/');

    const supportLink = page.locator('footer').getByRole('link', { name: 'help@getsystem.org' });
    await expect(supportLink).toBeVisible();
    await expect(supportLink).toHaveAttribute('href', 'mailto:help@getsystem.org');
  });
});
