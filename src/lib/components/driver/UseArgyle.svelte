<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  import { toast } from '@src/lib/toasts';
  import { argyleAccounts } from '@src/lib/stores/argyleAccounts';
  import createArgyleLinkInstance from '@src/lib/client/createArgyleLinkInstance';

  interface Props {
    onAbortRedirectTo: string;
    onSuccessRedirectTo?: string;
    onClose?: () => void;
    argyleLinkIds?: string[];
    // This is correctly nullble, but we should consider an implementation that
    // doesn't pass children at all
    children?: import('svelte').Snippet;
  }

  let {
    onAbortRedirectTo,
    onSuccessRedirectTo = '/driver/done',
    onClose = () => {},
    argyleLinkIds = [],
    children
  }: Props = $props();

  const argyleIsLoaded = () => {
    return window.Argyle !== undefined;
  };

  const handleArgyleLinkClose = async () => {
    /**
     * When the user closes the Argyle link, we want to check if they have any
     * connected accounts. If they do, we move forward in the flow.
     *
     * If not, we push them back out to the consent page.
     */
    if (argyleAccounts.getArgyleAccountsLength() === 0) {
      toast({ text: 'You exited out of linking your Uber/Lyft account.', type: 'info' });
      goto(onAbortRedirectTo);
    } else {
      goto(onSuccessRedirectTo);
    }
    if (onClose) {
      onClose();
    }
  };

  onMount(async () => {
    if (argyleIsLoaded() && $argyleAccounts.token) {
      const linkInstance = createArgyleLinkInstance(
        argyleLinkIds,
        $argyleAccounts.token,
        handleArgyleLinkClose
      );
      linkInstance.open();
    } else if (!argyleIsLoaded()) {
      // This should not happen since we load the script on the first driver page hit
      // See: src/routes/driver/+layout.svelte
      console.error('Argyle not loaded');
      alert('Argyle not loaded');
    } else {
      console.error('Argyle token not loaded. argyleAccounts.setToken needs to be called first.');
    }
  });
</script>

<section>
  {@render children?.()}
</section>
