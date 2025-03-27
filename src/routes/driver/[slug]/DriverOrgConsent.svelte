<script lang="ts">
  import { allAffiliations } from '@src/lib/stores/affiliations';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import { _ } from 'svelte-i18n';

  import ConsentToDataSharing from '@src/lib/components/driver/ConsentToDataSharing.svelte';

  dataSharingConsents.setAffiliateOrganizations(allAffiliations);
</script>

<div class="grid grid-row-flow-dense items-center w-full">
  <ConsentToDataSharing buttonText={$_('driver.org.link-my-uber-lyft-account')} />
  <p class="text-xs px-2 pt-12 text-center">
    {$_('driver.consent.note-that-you-may-receive-a-login-confirmation-text')}
  </p>
</div>
