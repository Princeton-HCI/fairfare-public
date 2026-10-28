<script lang="ts">
  interface Props {
    title: string;
    description?: string;
    children: import('svelte').Snippet;
  }

  let { title, description = '', children }: Props = $props();
</script>

<div class="py-4 border-b border-base-200">
  <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/50 mb-1">{title}</h3>
  {#if description}
    <p class="text-sm text-base-content/60 mb-3">{description}</p>
  {/if}
  {@render children()}
</div>
