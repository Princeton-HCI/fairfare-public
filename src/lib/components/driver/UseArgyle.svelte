<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  import { toast } from '@src/lib/toasts';
  import { _ } from 'svelte-i18n';
  import { argyleAccounts } from '@src/lib/stores/argyleAccounts';
  import createArgyleLinkInstance, {
    fetchArgyleBootstrap,
    startDemoPrefill
  } from '@src/lib/client/createArgyleLinkInstance';
  import { isDemoMode } from '@src/lib/utils';
  import { demoMessages } from '@src/lib/stores/demoMessages';
  import DemoCredentialsSidebar from './DemoCredentialsSidebar.svelte';
  import FakeSmsPreview from './FakeSmsPreview.svelte';

  interface Props {
    onAbortRedirectTo: string;
    onSuccessRedirectTo?: string;
    onClose?: () => void;
    argyleLinkIds?: string[];
    orgKey?: string;
    children?: import('svelte').Snippet;
  }

  let {
    onAbortRedirectTo,
    onSuccessRedirectTo = '/driver/done',
    onClose = () => {},
    argyleLinkIds = [],
    orgKey = undefined,
    children
  }: Props = $props();

  let showCredentials = $state(isDemoMode);
  let showSmsPreview = $state(false);

  const argyleIsLoaded = () => window.Argyle !== undefined;

  const handleArgyleLinkClose = async () => {
    if (argyleAccounts.getArgyleAccountsLength() === 0) {
      await fetch('/api/driver/argyle/cleanup-user', { method: 'POST' }).catch(() => {});
      toast({ text: $_('driver.argyle.exited-linking'), type: 'info' });
      goto(onAbortRedirectTo);
      onClose?.();
      return;
    }

    if (isDemoMode && $demoMessages.length > 0) {
      showSmsPreview = true;
      return;
    }

    goto(onSuccessRedirectTo);
    onClose?.();
  };

  const handleSmsPreviewClose = () => {
    showSmsPreview = false;
    demoMessages.clear();
    goto(onSuccessRedirectTo);
    onClose?.();
  };

  onMount(() => {
    let cleanupPrefill: (() => void) | undefined;

    const initArgyle = async () => {
      const bootstrap = await fetchArgyleBootstrap(orgKey);

      if (!bootstrap.canConnect) {
        const message =
          bootstrap.reason === 'over_capacity'
            ? 'This organization has reached its driver limit. Please contact your organizer.'
            : 'This organization is not accepting new driver connections right now.';
        toast({ text: message, type: 'info' });
        onClose?.();
        return;
      }

      argyleAccounts.setToken(bootstrap.token);

      if (!argyleIsLoaded()) {
        console.error('Argyle not loaded');
        alert('Argyle not loaded');
        return;
      }

      const linkInstance = createArgyleLinkInstance(bootstrap.token, handleArgyleLinkClose, {
        argyleLinkIds,
        apiHost: bootstrap.config.apiHost,
        flowId: bootstrap.config.flowId,
        organizationId: bootstrap.config.organizationId,
        orgKey
      });
      linkInstance.open();
      cleanupPrefill = startDemoPrefill();
    };

    initArgyle().catch((error) => {
      console.error(error);
      toast({ text: $_('driver.settings.something-went-wrong-please-try-again'), type: 'error' });
      onClose?.();
    });

    return () => {
      cleanupPrefill?.();
    };
  });
</script>

<section>
  {@render children?.()}
</section>

{#if showCredentials}
  <DemoCredentialsSidebar />
{/if}

{#if showSmsPreview}
  <FakeSmsPreview messages={$demoMessages} onClose={handleSmsPreviewClose} />
{/if}
