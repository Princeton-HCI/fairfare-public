<!-- @migration-task Error while migrating Svelte code: Encountered an export declaration pattern that is not supported for automigration. -->
<script lang="ts">
  import { _ } from 'svelte-i18n';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { title } from '@src/lib/stores/pageinfo';
  import { affiliations } from '@src/lib/stores/affiliations';
  import ChooseAffiliateOrganization from '../../../../lib/components/ChooseAffiliateOrganization.svelte';
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';

  title.set($_('driver.settings.update-settings'));

  let currentSlug = $derived(page.params.slug ?? page.data.slug);
  let selectedAffiliation = $derived($affiliations.selected);
  let affiliationsLoaded = $derived($affiliations.selectedAffiliationsAreLoadedFromDatabase);
  let continueUrl = $derived(
    selectedAffiliation?.key
      ? `/driver/org-data-sharing/${selectedAffiliation.key}`
      : '/driver/org-data-sharing'
  );
  let isRedirectingToConsent = $state(false);

  onMount(() => {
    if (currentSlug === 'org' || currentSlug === 'org-data-sharing') {
      affiliations.getSelectedAffiliationsFromDatabase();
    }
  });

  $effect(() => {
    if (currentSlug !== 'org-data-sharing' || !affiliationsLoaded || isRedirectingToConsent) {
      return;
    }

    isRedirectingToConsent = true;
    goto(continueUrl, { replaceState: true });
  });
</script>

<div class="flex flex-col items-center sm:px-2">
  {#if currentSlug == 'org'}
    <div class="text-sm breadcrumbs self-start">
      <ul>
        <li><a href="/driver/">{$_('nav.home')}</a></li>
        <li><a href="/driver/settings">{$_('nav.settings')}</a></li>
        <li>{$_('nav.affiliations')}</li>
      </ul>
    </div>
    <ChooseAffiliateOrganization showButton={false} preloadSelectedAffiliations />
    <BottomDrawer orientation="vertical">
      <a class="btn btn-neutral" href={continueUrl}>
        {$_('driver.settings.continue')}
      </a>
    </BottomDrawer>
  {:else if currentSlug == 'org-data-sharing'}
    <div class="text-sm breadcrumbs self-start">
      <ul>
        <li><a href="/driver/">{$_('nav.home')}</a></li>
        <li><a href="/driver/settings">{$_('nav.settings')}</a></li>
        <li><a href="/driver/settings/org">{$_('nav.affiliations')}</a></li>
        <li>{$_('nav.data-sharing')}</li>
      </ul>
    </div>
    <div class="prose self-start">
      <h1>{$_('nav.data-sharing')}</h1>
      <p>Loading the organization-specific sharing flow...</p>
    </div>
  {/if}
</div>
