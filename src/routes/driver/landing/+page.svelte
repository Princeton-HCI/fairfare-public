<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { title } from '@src/lib/stores/pageinfo';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { allAffiliations, loadAllAffiliations } from '@src/lib/stores/affiliations';

  title.set('Signup');
  // check if the user is already logged in
  const isLoggedIn = $state(page.data.session !== null);

  // Check for organization parameter in URL for deep links
  const orgFromUrl = $state(page.url.searchParams.get('org'));

  // Load organizations from DB so we can validate the org URL param
  loadAllAffiliations();

  let isValidOrg = $derived(
    orgFromUrl ? $allAffiliations.some((org) => org.key === orgFromUrl) : false
  );

  // Determine the appropriate redirect URL based on whether there's a valid org parameter
  const redirectUrl = $derived(
    isValidOrg ? `/driver/org-data-sharing/${orgFromUrl}` : '/driver/org'
  );

  // Auto-redirect only logged-in users with valid org deep links to skip landing page
  $effect(() => {
    if (isValidOrg && isLoggedIn) {
      // User is already logged in and has valid org - redirect directly to consent
      goto(redirectUrl);
    }
  });
</script>

<div class="prose container mx-auto px-5 text-neutral max-w-prose mt-4 prose-p:my-1">
  <h1 class="hero">
    {$_('driver.landing.how-much-of-your-ridehail-fare-goes-to-you')}
  </h1>
  <div class="flex justify-center">
    {#if isLoggedIn}
      <a href={redirectUrl} class="btn btn-neutral mb-4" data-sveltekit-preload-code="eager">
        {$_('driver.landing.join-our-study')}
      </a>
    {:else}
      <a
        href={`/driver/login?redirect=${encodeURIComponent(redirectUrl)}`}
        class="btn btn-neutral mb-4"
        data-sveltekit-preload-code="eager"
      >
        {$_('driver.landing.join-our-study')}
      </a>
    {/if}
  </div>
  <p>
    {$_('driver.landing.help-drivers-and-researchers-study-take-rates-and-study-fare-fairness')}
  </p>
  <ol class="prose-li:my-1">
    <li>
      {$_(
        'driver.landing.sign-a-consent-form-to-share-your-data-with-our-research-team-and-to-receive-notifications'
      )}
    </li>

    <li>{$_('driver.landing.link-your-uber-job-data-with-us-via-argyle')}</li>
  </ol>
  <p class="text-center">
    <a class="" href="/driver/instructions"> See detailed instructions in English </a>
  </p>
  <p class="text-center">
    <a class="" href="/driver/instrucciones"> Ver instrucciones detalladas en español </a>
  </p>
  <p class="text-center">
    <a class="" href="/driver/mode-demploi"> Voir instructions détaillées en français </a>
  </p>
</div>
