<script lang="ts">
  import InfoFilled from '@src/lib/icons/InfoFilled.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: Snippet;
    statistic: number;
    units?: string;
    round?: boolean;
    dollars?: boolean;
    invalid?: boolean;
  }
  let {
    title,
    description,
    statistic,
    units,
    round = false,
    dollars = false,
    invalid = false
  }: Props = $props();
  let formattedStatistic = $derived(round ? statistic.toFixed(0) : statistic.toFixed(2));
</script>

<div
  class="{invalid
    ? 'bg-gray-200/80 border-gray-400'
    : 'bg-white/80 border-secondary'} rounded-lg p-4 border-l-[3px] flex flex-col justify-between min-h-[5rem]"
>
  {#if statistic != null}
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-2xl font-bold text-base-content leading-tight">
          {#if dollars}${formattedStatistic}{:else}{formattedStatistic}{/if}
          {#if units}<span class="text-sm font-normal text-base-content/50 ml-1">{units}</span>{/if}
        </p>
        <p class="text-sm font-medium text-base-content/50 mt-1">{title}</p>
      </div>
      {#if description}
        <div class="group relative shrink-0">
          <InfoFilled />
          <div
            class="absolute right-0 bottom-full mb-2 hidden group-hover:block w-52 p-3 text-sm text-white bg-gray-900 rounded-lg shadow-lg z-10"
          >
            {@render description()}
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <p class="text-sm font-medium text-base-content/50">{title}</p>
    <p class="text-sm text-error mt-1">Error calculating this statistic</p>
  {/if}
</div>
