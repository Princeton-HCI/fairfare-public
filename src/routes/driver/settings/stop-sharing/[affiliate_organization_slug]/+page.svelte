<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { page } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import {
    SYSTEM_VIRTUAL_PRIMARY_KEY,
    SYSTEM_VIRTUAL_PRIMARY_NAME
  } from '@src/lib/affiliationConstants';
  import { allAffiliations, loadAllAffiliations } from '@src/lib/stores/affiliations';
  import { onMount } from 'svelte';
  import { supabase } from '@src/lib/client/db';
  import { goto } from '$app/navigation';
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';
  import BackButton from '@src/lib/components/BackButton.svelte';
  import { toast } from '@src/lib/toasts';
  import UseToast from '@src/lib/components/UseToast.svelte';
  import Spinner from '@src/lib/components/Spinner.svelte';

  const { affiliate_organization_slug } = page.params;

  let organizationName = $state(
    affiliate_organization_slug === SYSTEM_VIRTUAL_PRIMARY_KEY ? SYSTEM_VIRTUAL_PRIMARY_NAME : ''
  );
  let isLoading = $state(false);

  title.set('Stop sharing data');

  loadAllAffiliations();

  $effect(() => {
    if (affiliate_organization_slug === SYSTEM_VIRTUAL_PRIMARY_KEY) return;
    const org = $allAffiliations.find((org) => org.key === affiliate_organization_slug);
    if (org) {
      organizationName = org.name;
    }
  });

  onMount(async () => {
    // Check if user is logged in
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) {
      goto('/driver/landing');
    }
  });

  const handleStopSharing = async () => {
    if (!affiliate_organization_slug) {
      toast({ text: 'Invalid organization', type: 'error' });
      return;
    }

    isLoading = true;

    try {
      // Virtual primary (driver has Argyle accounts under System global
      // creds with no real primary org) uses a distinct scope so the server
      // tears down global accounts + consents without touching org rows.
      const body =
        affiliate_organization_slug === SYSTEM_VIRTUAL_PRIMARY_KEY
          ? { scope: 'virtual-primary' as const }
          : {
              scope: 'organization' as const,
              affiliationKey: affiliate_organization_slug
            };

      const response = await fetch('/api/driver/stop-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast({
          text: `Successfully stopped sharing data with ${organizationName}`,
          type: 'success'
        });
        // Redirect back to settings after a short delay
        setTimeout(() => {
          goto('/driver/settings');
        }, 120);
      } else {
        const errorText = await response.text();
        toast({
          text: `Failed to stop sharing: ${errorText}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error stopping data sharing:', error);
      toast({
        text: 'An error occurred. Please try again.',
        type: 'error'
      });
    } finally {
      isLoading = false;
    }
  };
</script>

<UseToast />

<div class="prose">
  <h1>
    {$_('settings.stop-sharing.stop-sharing-data-with-org', { values: { org: organizationName } })}
  </h1>
  <p>
    {$_('settings.stopping-sharing-with-org-will', { values: { org: organizationName } })}
  </p>
  <ul>
    <li>
      {$_('settings.stopping-sharing-with-org-will-prevent-org-from-accessing-data', {
        values: { org: organizationName }
      })}
    </li>
    <li>
      {$_('settings.stopping-sharing-with-org-will-notify-org-about-your-preference', {
        values: { org: organizationName }
      })}
    </li>
  </ul>
</div>

<!-- Bottom Navigation -->
<BottomDrawer>
  <BackButton href="/driver/settings" moreClasses="md:hidden" />
  <button class="btn btn-error" onclick={handleStopSharing} disabled={isLoading}>
    {#if isLoading}
      <Spinner />
      {$_('settings.stop-sharing.stopping')}
    {:else}
      {$_('settings.stop-sharing.stop-sharing')}
    {/if}
  </button>
</BottomDrawer>
