<script lang="ts">
  import CircleCheckFilled from '../icons/CircleCheckFilled.svelte';
  import CircleXFilled from '../icons/CircleXFilled.svelte';

  interface Props {
    value: boolean;
  }

  let { value }: Props = $props();
</script>

{#if value}
  <span class="text-primary">
    <CircleCheckFilled />
  </span>
{:else}
  <span class="text-error">
    <CircleXFilled />
  </span>
{/if}
