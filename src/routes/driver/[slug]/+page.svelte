<script lang="ts">
  import short from 'short-uuid';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import { browser, dev } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { argyleAccounts } from '@src/lib/stores/argyleAccounts';

  import UseArgyle from '@src/lib/components/driver/UseArgyle.svelte';
  import { toast } from '@src/lib/toasts';

  import ChooseAffiliateOrganization from './ChooseAffiliateOrganization.svelte';
  import DriverOrgConsent from './DriverOrgConsent.svelte';

  import { title } from '@src/lib/stores/pageinfo';

  import LandingPage from './LandingPage.svelte';
  import { createUserAccountIfMissing } from '@src/lib/client/createUserAccountIfMissing';
  import { UserDoesNotExistError } from '@src/lib/errors';
  import { isDemoMode } from '@src/lib/utils';

  title.set('Signup');

  // if we're on /argyle, load Argyle Link. otherwise, close it.
  onMount(async () => {
    // Here we check to see if the user is already logged in.
    // If they are not, we create a new user and log them in.
    try {
      await createUserAccountIfMissing();
    } catch (error) {
      if (error instanceof UserDoesNotExistError) {
        toast({ text: 'No user found.', type: 'error' });
        return;
      }
      throw error;
    }
  });

  const translator = short();
  let shortUUID = $derived(page.data.user && translator.fromUUID(page.data.user.id));
  let surveyLink = $derived(browser ? `${window.origin}/driver/data/${shortUUID}` : '');
</script>

{#if page.data.slug == 'landing'}
  <LandingPage onCallToAction={() => goto('/driver/org')} />
{:else if page.data.slug == 'org'}
  <ChooseAffiliateOrganization />
{:else if page.data.slug == 'org-data-sharing'}
  <DriverOrgConsent />
{:else if page.data.slug == 'argyle' && $argyleAccounts.userId}
  <UseArgyle onAbortRedirectTo="/driver/org-data-sharing">
    {#if isDemoMode}
      <!-- The Argyle overlay z-index is set to 999999999 -->
      <!-- For this reason, have to use a higher value for the overlay to work  -->
      <div class="z-[9999999999] absolute top-0 right-0 bg-warning p-1 leading-tight text-xs">
        <p class="uppercase"><strong>Log in with:</strong></p>
        <p>Platform: <code>Uber Driver</code></p>
        <p>Phone: <code>800 900-0010</code></p>
        <p>OTP: <code>8081</code></p>
      </div>
    {/if}
    <div class="container flex flex-col justify-center h-screen -mt-20 prose">
      <div class="flex flex-col items-center text-center px-4 py-2">
        <h3>{$_('driver.argyle-link.preparing-to-connect-your-data')}</h3>
        <span class="loading loading-ring loading-lg text-primary"></span>
        <p class="text-xs px-2 py-1">
          {$_('driver.consent.note-that-you-may-receive-a-login-confirmation-text')}
        </p>
      </div>
    </div>
  </UseArgyle>
{:else if page.data.slug == 'error'}
  <h1 class="text-error">{$_('driver.settings.something-went-wrong-please-try-again')}</h1>
{:else if page.data.slug == 'done'}
  <div class="prose">
    <h1>
      {$_('driver.done.youre-done')}
    </h1>
    <img
      src="/img/thank-you-for-sharing-your-data.png"
      alt="A person and a dog driving quickly in a car."
      class="w-1/2 mx-auto max-w-[250px]"
    />
    <p>{$_('driver.done.syncing-your-data-can-take-up-to-a-few-hours')}</p>
    {#if dev}
      <!-- skipping i18n here for dev only -->
      <div class="flex flex-col items-center w-full">
        <a href={surveyLink} class="btn btn-primary"> Open driver data</a>
        <p class="text-xs">(Visible only in development)</p>
      </div>
    {/if}
  </div>
{:else}
  <LandingPage onCallToAction={() => goto('/driver/org')} />
{/if}
