<script lang="ts">
  import Header from '@src/lib/components/layout/Header.svelte';
  import LoggedInFooter from '@src/lib/components/layout/LoggedInFooter.svelte';

  import { page } from '$app/state';
  import profileIsSynced from '@src/lib/client/profileIsSynced';
  import UseToast from '@src/lib/components/UseToast.svelte';
  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  let profile = $derived(page.data?.profile);
</script>

<UseToast />
<div class="flex flex-col w-full items-center max-w-prose h-screen justify-between">
  <Header profileIsSynced={profileIsSynced(profile)} />
  <div class="px-4 flex-grow w-full">
    {@render children()}
  </div>
  <LoggedInFooter />
</div>

<svelte:head>
  <script defer src="https://plugin.argyle.com/argyle.web.v5.js"></script>
</svelte:head>
