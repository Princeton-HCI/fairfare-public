<script lang="ts">
  import Header from '@src/lib/components/layout/Header.svelte';
  import LoggedInFooter from '@src/lib/components/layout/LoggedInFooter.svelte';

  import UseToast from '@src/lib/components/UseToast.svelte';
  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();
</script>

<UseToast />
<div class="flex flex-col w-full items-center max-w-prose h-screen justify-between">
  <Header />
  <div class="px-4 flex-grow w-full">
    {@render children()}
  </div>
  <LoggedInFooter />
</div>

<svelte:head>
  <script defer src="https://plugin.argyle.com/argyle.web.v5.js"></script>
</svelte:head>
