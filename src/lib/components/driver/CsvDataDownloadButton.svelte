<script lang="ts">
  import ConfirmIdentityWithOtpModal from '@src/lib/components/Auth/ConfirmIdentityWithOtpModal.svelte';
  import Spinner from '@src/lib/components/Spinner.svelte';
  import { toast } from '@src/lib/toasts';
  import { _ } from 'svelte-i18n';

  interface Props {
    userId: string;
    phoneNumberLastTwo: string;
    title?: string;
  }

  let {
    userId,
    phoneNumberLastTwo,
    title = $_('components.driver.csvDataDownloadButton.download-data')
  }: Props = $props();

  let isLoading = $state(false);

  const onSuccessfulLogin = () => {
    console.log('success');
    isLoading = true;
    fetch('/api/download/activities', {
      method: 'GET',
      headers: { 'Content-Type': 'text/csv' }
    }).then((response) => {
      // Save the file
      response.blob().then((blob) => {
        const file = window.URL.createObjectURL(blob);
        window.location.assign(file);
        isLoading = false;
        toast({
          text: $_('components.driver.csvDataDownloadButton.successfully-downloaded'),
          type: 'success'
        });
      });
    });
  };
</script>

<ConfirmIdentityWithOtpModal {userId} {phoneNumberLastTwo} {onSuccessfulLogin}>
  {#if isLoading}
    <Spinner />
    {$_('components.driver.csvDataDownloadButton.downloading-data')}
  {:else}
    {title}
  {/if}
</ConfirmIdentityWithOtpModal>
