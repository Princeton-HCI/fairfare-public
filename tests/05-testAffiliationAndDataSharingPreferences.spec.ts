import { test, expect } from '@playwright/test';
test.describe('Signing up for the study', () => {
  // FIXME: update title once the argyle portion is complete, e.g.,
  // closing the argyle link window works as expected
  test('Sign up and affiliation/data sharing preference persistence work as expected', async ({
    page
  }) => {
    await page.goto('/');

    // Click the "Join The Study" link
    await page.getByRole('link', { name: 'Join The Study 🚀' }).click();

    await page.waitForURL('**/driver/landing');
    await page.getByRole('button', { name: 'Join Our Study' }).click();

    /** Affiliation screen **/
    await page.waitForURL('**/driver/org');

    // select PELQ
    await page.getByText('PELQ/PELQ').click();

    // reload and confirm this is still selected
    await page.reload();

    // wait 0.5s for the page to load
    await page.waitForTimeout(500);
    const selectedRadiosIds = await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      return (
        Array.from(radios)
          // @ts-expect-error Property 'checked' does not exist on type 'Element'.ts(2339)
          .filter((radio) => radio.checked)
          .map((radio) => radio.id)
      );
    });

    expect(selectedRadiosIds).toEqual(['pelq']);

    await page.getByRole('button', { name: 'Continue' }).click();

    /** Data sharing screen **/
    await page.waitForURL('**/driver/org-data-sharing');

    // expect the link my Uber/Lyft account button to be disabled
    expect(await page.getByRole('button', { name: 'Link my Uber/Lyft account' }).isEnabled()).toBe(
      false
    );
    await page.getByText('Share', { exact: true }).click();
    // now the link my Uber/Lyft account button should be enabled
    expect(await page.getByRole('button', { name: 'Link my Uber/Lyft account' }).isEnabled()).toBe(
      true
    );

    await page.getByRole('button', { name: 'Link my Uber/Lyft account' }).click();

    /** Argyle page **/
    await page.waitForURL('**/driver/argyle');

    // sleep for 5s to allow the argyle page to load
    await page.waitForTimeout(5000);

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
