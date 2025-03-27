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
    const heroText = await page.textContent('h1');
    expect(heroText).toContain('How much is Uber taking from your fares?');

    // Check for the "Join the study" button
    const joinButton = await page.$('button:has-text("Join our study")');
    expect(joinButton).not.toBeNull();

    // Check for the footer link
    const footerLink = await page.$('footer a:has-text("Learn more")');
    expect(footerLink).not.toBeNull();
  });

  test('should navigate to the affiliations screen after clicking "Join the study"', async ({
    page
  }) => {
    // Click the "Join the study" button
    await page.click('button:has-text("Join our study")');

    const headerTitle = page.getByRole('heading', { name: 'Your affiliation' });
    await expect(headerTitle).toBeVisible();
  });
});
