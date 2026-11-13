<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { title } from '@src/lib/stores/pageinfo';
  import DataBox from '@src/lib/components/organizer/dash/DataBox.svelte';
  import type { PolicyStatsResponse } from '@src/routes/api/organizer/policy_analysis_stats/+server';

  title.set('Research aggregates');

  let backendData: PolicyStatsResponse | null = $state(null);
  let isLoading = $state(true);
  let errorMessage = $state('');

  onMount(async () => {
    try {
      const params = new URLSearchParams({ selectedScope: 'all' });
      const response = await fetch(`/api/organizer/policy_analysis_stats?${params}`);
      if (!response.ok) {
        errorMessage = response.status === 403 ? 'You do not have access to these aggregates.' : '';
        return;
      }
      backendData = await response.json();
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="max-w-5xl">
  <h1 class="font-serif text-3xl font-bold text-base-content mb-1">Research aggregates</h1>
  <p class="text-base-content/60 mb-8">{$_('research.description')}</p>

  {#if isLoading}
    <p>{$_('organizer.policy-analysis.data-loading')}</p>
  {:else if errorMessage}
    <p class="text-error">{errorMessage}</p>
  {:else if backendData}
    <div class="grid gap-4 sm:grid-cols-2">
      <DataBox
        title={$_('organizer.policy-analysis.total-trips')}
        statistic={backendData.totalNumberOfTrips}
        round
      />
      <DataBox
        title={$_('organizer.policy-analysis.average-distance')}
        statistic={backendData.averageDistancePerTrip}
        units={$_('organizer.policy-analysis.miles-per-trip')}
      />
      <DataBox
        title={$_('organizer.policy-analysis.average-hourly-rate')}
        statistic={backendData.averageHourlyRate}
        units={$_('organizer.policy-analysis.dollars-per-hour')}
        dollars
      />
      <DataBox
        title={$_('organizer.policy-analysis.average-pay')}
        statistic={backendData.averageDriverPayPerTrip}
        units={$_('organizer.policy-analysis.dollars-per-trip')}
        dollars
      />
    </div>
  {:else}
    <p>{$_('organizer.policy-analysis.no-data')}</p>
  {/if}
</div>
