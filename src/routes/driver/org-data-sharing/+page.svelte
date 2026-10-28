<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { title } from '@src/lib/stores/pageinfo';

  import { allAffiliations, loadAllAffiliations } from '@src/lib/stores/affiliations';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import ConsentToDataSharing from '@src/lib/components/driver/ConsentToDataSharing.svelte';
  import { supabase } from '@src/lib/client/db';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  title.set('Data Sharing');

  loadAllAffiliations();

  $effect(() => {
    if ($allAffiliations.length > 0) {
      dataSharingConsents.setAffiliateOrganizations($allAffiliations);
    }
  });

  // redirect to landing page if user is not logged in
  onMount(async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) {
      goto('/driver/landing');
    }
  });
</script>

<div class="grid grid-row-flow-dense items-center w-full">
  <ConsentToDataSharing buttonText={$_('driver.org.link-my-uber-lyft-account')} />
  <p class="text-xs px-2 pt-12 text-center">
    {$_('driver.consent.note-that-you-may-receive-a-login-confirmation-text')}
  </p>
</div>
