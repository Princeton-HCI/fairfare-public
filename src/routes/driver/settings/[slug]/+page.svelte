<!-- @migration-task Error while migrating Svelte code: Encountered an export declaration pattern that is not supported for automigration. -->
<script lang="ts">
  import { _ } from 'svelte-i18n';

  import { page } from '$app/state';
  import { toast } from '@src/lib/toasts';

  import ConsentToDataSharing from '@src/lib/components/driver/ConsentToDataSharing.svelte';
  import { affiliations } from '@src/lib/stores/affiliations';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import { title } from '@src/lib/stores/pageinfo';
  import ChooseAffiliateOrganization from '../../[slug]/ChooseAffiliateOrganization.svelte';
  import { goto } from '$app/navigation';
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';

  const onOrgConsentUpdate = async () => {
    try {
      await dataSharingConsents.updateDatabase();
      await affiliations.updateDatabase();
    } catch (error) {
      console.error('Error updating data sharing consents:', error);
      toast({ text: $_('driver.settings.something-went-wrong-please-try-again'), type: 'error' });
      return;
    }

    toast({
      text: $_('driver.settings.your-data-sharing-preferences-have-been-updated'),
      type: 'success'
    });
    // update stores
    await affiliations.getSelectedAffiliationsFromDatabase();
    await dataSharingConsents.getSelectedDataSharingConsentsFromDatabase();

    // redirect to /driver/settings/
    goto('/driver/settings');
  };

  title.set($_('driver.settings.update-settings'));
</script>

<div class="flex flex-col items-center sm:px-2">
  {#if page.data.slug == 'org'}
    <div class="text-sm breadcrumbs self-start">
      <ul>
        <li><a href="/driver/">{$_('nav.home')}</a></li>
        <li><a href="/driver/settings">{$_('nav.settings')}</a></li>
        <li>{$_('nav.affiliations')}</li>
      </ul>
    </div>
    <ChooseAffiliateOrganization showButton={false} preloadSelectedAffiliations />
    <BottomDrawer orientation="vertical">
      <a class="btn btn-neutral" href="/driver/settings/org-data-sharing">
        {$_('driver.settings.continue')}
      </a>
    </BottomDrawer>
  {:else if page.data.slug == 'org-data-sharing'}
    <div class="text-sm breadcrumbs self-start">
      <ul>
        <li><a href="/driver/">{$_('nav.home')}</a></li>
        <li><a href="/driver/settings">{$_('nav.settings')}</a></li>
        <li><a href="/driver/settings/org">{$_('nav.affiliations')}</a></li>
        <li>{$_('nav.data-sharing')}</li>
      </ul>
    </div>
    <ConsentToDataSharing
      buttonText={$_('driver.settings.update')}
      onButtonClick={onOrgConsentUpdate}
      preloadSelectedConsents
    />
  {/if}
</div>
