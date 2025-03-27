<script lang="ts">
  import { page } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import Header from '@src/lib/components/layout/Header.svelte';
  import profileIsSynced from '@src/lib/client/profileIsSynced';
  const errorMessage = page.error?.message;
  const is404Error = errorMessage === 'Not Found';
  // Set the HTML title
  title.set('Error');
  // Function to reload the page
  const reloadPage = () => {
    location.reload();
  };
  let profile = $derived(page.data?.profile);
</script>

<Header profileIsSynced={profileIsSynced(profile)} />

<div class="prose text-center min-h-screen px-4">
  {#if is404Error}
    <img
      src="/img/instructions/404Image.png"
      alt="404 illustration of people asking questions at a whiteboard."
      class="w-[200px] mx-auto"
    />
    <h1>Oops! This page doesn't exist.</h1>
    <p>The page you're looking for might have been moved, renamed, or never existed.</p>
    <a href="/" class="btn btn-neutral"> Back to Home </a>
  {:else}
    <img
      src="/img/instructions/5xxImage.png"
      alt="Server error illustration."
      class="w-[200px] mx-auto"
    />
    <h1>Something went wrong on our end.</h1>
    <p>We're working to fix the issue.</p>
    {#if errorMessage}
      <p>Error message: {errorMessage}</p>
    {/if}
    <button onclick={reloadPage} class="btn btn-neutral"> Refresh the Page </button>
  {/if}
</div>
