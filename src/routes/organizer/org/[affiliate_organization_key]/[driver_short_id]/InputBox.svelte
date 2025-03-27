<script lang="ts">
  interface Props {
    title: string;
    description?: string;
    children: import('svelte').Snippet;
  }

  let { title, description = '', children }: Props = $props();
</script>

<div class="border rounded-sm p-2 mt-4 bg-white">
  <h3 class="font-bold text-md">{title}</h3>
  {#if description}
    <p class="text-sm">{description}</p>
  {/if}
  {@render children()}
</div>
