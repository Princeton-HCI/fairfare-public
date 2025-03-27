<script lang="ts">
  import { _ } from 'svelte-i18n';

  interface Props {
    averagePlatformTakePctString: string;
    minPlatformTakeString: string;
    maxPlatformTakeString: string;
  }

  let { averagePlatformTakePctString, minPlatformTakeString, maxPlatformTakeString }: Props =
    $props();

  let dataBoxValues = [
    {
      value: minPlatformTakeString,
      label: $_('components.MinimumAverageMaxiumumTakeChart.minimum')
    },
    {
      value: averagePlatformTakePctString,
      label: $_('components.MinimumAverageMaxiumumTakeChart.average')
    },
    {
      value: maxPlatformTakeString,
      label: $_('components.MinimumAverageMaxiumumTakeChart.maximum')
    }
  ];
</script>

<div class="bg-neutral text-neutral-content grid grid-cols-3 p-4 text-center">
  {#each dataBoxValues as { value, label }}
    <div class="flex flex-col">
      <span class="text-2xl font-medium">{value}%</span>
      <span class="text-sm">{label}</span>
    </div>
  {/each}
</div>
