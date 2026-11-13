<script lang="ts">
  import { page } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import Header from '@src/lib/components/layout/Header.svelte';

  const status = $derived(page.status);
  const errorMessage = $derived(page.error?.message);
  const is404 = $derived(status === 404);
  const isForbidden = $derived(status === 401 || status === 403);

  const titleFor = (httpStatus: number): string =>
    httpStatus === 401 || httpStatus === 403
      ? 'Access denied'
      : httpStatus === 404
        ? 'Not found'
        : 'Error';

  // Set once during render so the server-rendered <title> is right, and again in
  // an effect so a client-side navigation to a different error updates it.
  // `$effect` alone runs only in the browser, which left the SSR'd title showing
  // whatever the previous page had set.
  title.set(titleFor(page.status));
  $effect(() => {
    title.set(titleFor(status));
  });

  const reloadPage = () => {
    location.reload();
  };
</script>

<Header />

<div class="prose text-center min-h-screen px-4">
  {#if is404}
    <img
      src="/img/instructions/404Image.webp"
      alt="404 illustration of people asking questions at a whiteboard."
      class="w-[200px] mx-auto"
    />
    <h1>Oops! This page doesn't exist.</h1>
    <p>The page you're looking for might have been moved, renamed, or never existed.</p>
    <a href="/" class="btn btn-neutral"> Back to Home </a>
  {:else if isForbidden}
    <img
      src="/img/instructions/404Image.webp"
      alt="Access denied illustration."
      class="w-[200px] mx-auto"
    />
    <h1>You don't have access to this page.</h1>
    <p>This area is only available to people with the right role for this organization.</p>
    <a href="/" class="btn btn-neutral"> Back to Home </a>
  {:else}
    <img
      src="/img/instructions/5xxImage.webp"
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
