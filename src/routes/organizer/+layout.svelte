<script lang="ts">
  import UseToast from '@src/lib/components/UseToast.svelte';
  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();
</script>

<UseToast />
<div class="w-full p-4 max-w-3xl mx-auto">
  {@render children()}
</div>
