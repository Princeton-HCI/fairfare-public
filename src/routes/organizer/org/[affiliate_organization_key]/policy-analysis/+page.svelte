<script lang="ts">
  import { page } from '$app/state';
  import { _ } from 'svelte-i18n';
  import { title } from '@src/lib/stores/pageinfo';
  import DateInput from '@src/lib/components/DateInput.svelte';
  import DataBox from '@src/lib/components/organizer/dash/DataBox.svelte';
  import DownloadCsvButton from '@src/lib/components/organizer/dash/DownloadCsvButton.svelte';
  import InputBox from '@src/lib/components/organizer/dash/InputBox.svelte';
  import type { PolicyStatsResponse } from '@src/routes/api/organizer/policy_analysis_stats/+server';
  import { getStateAbbrev, states } from '@src/routes/organizer/utils';
  import Svelecte from 'svelecte';
  import { hasCapability } from '@src/lib/rbac';

  const { affiliate_organization_key: affiliateOrganizationKey } = page.params;

  let filterStartDate = $state('');
  let filterEndDate = $state('');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  function formatDate(date: Date) {
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
  let resolvedFilterEndDate = $derived.by(() => {
    if (!filterEndDate) return formatDate(yesterday);
    return filterEndDate;
  });

  let selectedItemStart = $state<string | undefined>(undefined);
  let selectedItemEnd = $state<string | undefined>(undefined);
  let locationCombiner = $state('OR');

  const stateNames = states.map((state) => state.name);
  let endDateBeforeStartDate = $derived(new Date(filterStartDate) > new Date(filterEndDate));

  let platformsAll = [
    { value: 'doordash', text: 'DoorDash' },
    { value: 'grubhub', text: 'Grubhub' },
    { value: 'lyft', text: 'Lyft' },
    { value: 'postmates', text: 'Postmates' },
    { value: 'uber', text: 'Uber' },
    { value: 'ubereats', text: 'Uber Eats' }
  ];

  let platformsRidehail = [
    { value: 'lyft', text: 'Lyft' },
    { value: 'uber', text: 'Uber' }
  ];

  let platformsDelivery = [
    { value: 'doordash', text: 'DoorDash' },
    { value: 'grubhub', text: 'Grubhub' },
    { value: 'postmates', text: 'Postmates' },
    { value: 'ubereats', text: 'Uber Eats' }
  ];

  let category = $state('all');
  let platform = $state<string>();
  const setCategory = (cat: string) => {
    category = cat;
  };
  let resolvedPlatforms = $derived.by(() => {
    if (platform) return [platform];
    if (category === 'ridehail') return platformsRidehail.map((item) => item.value);
    if (category === 'delivery') return platformsDelivery.map((item) => item.value);
    return [];
  });
  let lyftSelected = $derived(
    platform === 'lyft' ||
      (category === 'all' && (!platform || platform === 'lyft')) ||
      (category === 'ridehail' && platform !== 'uber')
  );

  let selectedScope = $state(affiliateOrganizationKey);
  const setScope = (scope: string) => {
    selectedScope = scope;
  };

  let isLoading = $state(false);
  let hideStats = $state(false);
  let backendData: PolicyStatsResponse | null = $state(null);

  let resolvedStartLocation = $derived.by(() => {
    if (!selectedItemStart) return undefined;
    return getStateAbbrev(selectedItemStart);
  });

  let resolvedEndLocation = $derived.by(() => {
    if (!selectedItemEnd) return undefined;
    return getStateAbbrev(selectedItemEnd);
  });

  $effect(() => {
    filterStartDate = filterStartDate;
    filterEndDate = filterEndDate;
    selectedItemStart = selectedItemStart;
    selectedItemEnd = selectedItemEnd;
    locationCombiner = locationCombiner;
    category = category;
    platform = platform;
    selectedScope = selectedScope;

    hideStats = true;
  });

  function fetchData() {
    isLoading = true;

    const params = new URLSearchParams({
      filterStartDate,
      filterEndDate: resolvedFilterEndDate,
      selectedScope,
      locationCombiner
    });

    if (resolvedStartLocation) {
      params.set('startLocation', resolvedStartLocation);
    }
    if (resolvedEndLocation) {
      params.set('endLocation', resolvedEndLocation);
    }
    if (category && !platform) {
      if (category === 'ridehail')
        params.set('platforms', platformsRidehail.map((item) => item.value).join());
      else if (category === 'delivery')
        params.set('platforms', platformsDelivery.map((item) => item.value).join());
    } else if (platform) {
      params.set('platforms', platform);
    }

    fetch(`/api/organizer/policy_analysis_stats?${params.toString()}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch statistics (${response.status})`);
        }
        return response.json();
      })
      .then((data) => {
        backendData = data;
      })
      .catch((err) => {
        console.error('Error fetching statistics:', err);
        backendData = null;
      })
      .finally(() => {
        isLoading = false;
        hideStats = false;
      });
  }

  title.set('Organizer | Policy Analysis');

  let currentPlatformOptions = $derived.by(() => {
    if (category === 'ridehail') return platformsRidehail;
    if (category === 'delivery') return platformsDelivery;
    return platformsAll;
  });

  let currentPlatformPlaceholder = $derived.by(() => {
    if (category === 'ridehail')
      return $_('organizer.policy-analysis.platform-filter.select-ridehail');
    if (category === 'delivery')
      return $_('organizer.policy-analysis.platform-filter.select-delivery');
    return $_('organizer.policy-analysis.platform-filter.select-all');
  });
</script>

<div>
  <h1 class="font-serif text-2xl font-medium text-base-content">
    {$_('organizer.policy-analysis.title')}
  </h1>
  <p class="text-sm text-base-content/50 mt-1">
    Filter and analyze trip data across platforms, locations, and date ranges.
  </p>

  <div class="mt-6">
    <InputBox
      title={$_('organizer.policy-analysis.date-filter.title')}
      description={$_('organizer.policy-analysis.date-filter.description')}
    >
      {#if endDateBeforeStartDate}
        <p class="text-sm text-error mb-2">{$_('organizer.policy-analysis.date-filter.error')}</p>
      {/if}
      <div class="flex flex-col sm:flex-row gap-3">
        <DateInput
          label={$_('organizer.policy-analysis.date-filter.start')}
          name="filterStartDate"
          max={yesterday}
          bind:value={filterStartDate}
        />
        <DateInput
          label={$_('organizer.policy-analysis.date-filter.end')}
          name="filterEndDate"
          max={yesterday}
          bind:value={filterEndDate}
        />
      </div>
    </InputBox>

    <InputBox
      title={$_('organizer.policy-analysis.location-filter.title')}
      description={$_('organizer.policy-analysis.location-filter.description')}
    >
      <div class="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div class="flex items-center gap-2 flex-1 w-full">
          <span class="text-sm text-base-content/60 shrink-0">Starts in:</span>
          <Svelecte
            options={stateNames}
            bind:value={selectedItemStart}
            placeholder={$_('organizer.policy-analysis.location-filter.state-placeholder')}
          />
        </div>
        <Svelecte
          class="max-w-min"
          options={['OR', 'AND']}
          searchable={false}
          deselectMode={'none'}
          bind:value={locationCombiner}
        />
        <div class="flex items-center gap-2 flex-1 w-full">
          <span class="text-sm text-base-content/60 shrink-0">Ends in:</span>
          <Svelecte
            options={stateNames}
            bind:value={selectedItemEnd}
            placeholder="Enter a state in the US"
          />
        </div>
      </div>
    </InputBox>

    <InputBox
      title={$_('organizer.policy-analysis.platform-filter.title')}
      description={$_('organizer.policy-analysis.platform-filter.description')}
    >
      <div class="flex flex-wrap gap-2 mb-3">
        <button
          class="btn btn-sm {category === 'all' ? 'btn-secondary' : ''}"
          onclick={() => setCategory('all')}
        >
          {$_('organizer.policy-analysis.platform-filter.all')}
        </button>
        <button
          class="btn btn-sm {category === 'ridehail' ? 'btn-secondary' : ''}"
          onclick={() => setCategory('ridehail')}
        >
          {$_('organizer.policy-analysis.platform-filter.ridehail')}
        </button>
        <button
          class="btn btn-sm {category === 'delivery' ? 'btn-secondary' : ''}"
          onclick={() => setCategory('delivery')}
        >
          {$_('organizer.policy-analysis.platform-filter.delivery')}
        </button>
      </div>
      <Svelecte
        options={currentPlatformOptions}
        searchable={false}
        bind:value={platform}
        placeholder={currentPlatformPlaceholder}
      />
    </InputBox>

    <InputBox
      title={$_('organizer.policy-analysis.organization-filter.title')}
      description={$_('organizer.policy-analysis.organization-filter.description')}
    >
      <div class="flex flex-wrap gap-2">
        <button
          class="btn btn-sm {selectedScope === affiliateOrganizationKey ? 'btn-secondary' : ''}"
          onclick={() => setScope(affiliateOrganizationKey)}
        >
          {affiliateOrganizationKey}
        </button>
        {#if hasCapability(page.data.roles, 'platform:view_cross_org_aggregates')}
          <button
            class="btn btn-sm {selectedScope === 'all' ? 'btn-secondary' : ''}"
            onclick={() => setScope('all')}
          >
            {$_('organizer.policy-analysis.organization-filter.aggregate')}
          </button>
        {/if}
      </div>
    </InputBox>
  </div>

  <div class="flex items-center gap-4 pt-6">
    <button
      onclick={() => fetchData()}
      class="btn btn-primary {hideStats ? 'ring-2 ring-primary/40 ring-offset-2' : ''}"
      disabled={isLoading}
    >
      {#if isLoading}
        <span class="loading loading-spinner loading-sm mr-2"></span>
        {$_('organizer.searching')}
      {:else}
        {$_('organizer.search')}
      {/if}
    </button>
    <DownloadCsvButton
      startDateString={filterStartDate}
      endDateString={resolvedFilterEndDate}
      startLocation={resolvedStartLocation ?? ''}
      endLocation={resolvedEndLocation ?? ''}
      {locationCombiner}
      platforms={resolvedPlatforms ?? []}
      {affiliateOrganizationKey}
      disabled={selectedScope == 'all'}
      tool="POLICY"
    />
  </div>

  {#if lyftSelected}
    <p class="text-sm mt-1 text-red-500">
      {$_('organizer.policy-analysis.platform-filter.lyft-note')}
    </p>
  {/if}

  {#if isLoading}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {#each Array(8) as _}
        <div class="bg-base-200/50 rounded-lg h-24 animate-pulse"></div>
      {/each}
    </div>
  {:else if backendData && backendData?.totalNumberOfTrips != 0 && !hideStats}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      <DataBox
        title={$_('organizer.policy-analysis.total-trips')}
        statistic={backendData.totalNumberOfTrips}
        round={true}
      />

      <DataBox
        title={$_('organizer.policy-analysis.average-distance')}
        statistic={backendData?.averageDistancePerTrip}
        units={$_('organizer.policy-analysis.miles-per-trip')}
      >
        {#snippet description()}
          <p>
            sum of <a
              class="underline"
              href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>trip distances</a
            >
            / number of trips
          </p>
        {/snippet}
      </DataBox>

      <DataBox
        title={$_('organizer.policy-analysis.average-charge')}
        statistic={backendData?.averageCustomerChargePerTrip}
        units={$_('organizer.policy-analysis.dollars-per-trip')}
        dollars={true}
        invalid={lyftSelected}
      >
        {#snippet description()}
          <p>
            sum of <a
              class="underline"
              href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>customer charges</a
            >
            (with tip) / number of trips
          </p>
        {/snippet}
      </DataBox>

      <DataBox
        title={$_('organizer.policy-analysis.average-charge-no-tip')}
        statistic={backendData?.averageCustomerChargePerTripNoTip}
        units={$_('organizer.policy-analysis.dollars-per-trip')}
        dollars={true}
        invalid={lyftSelected}
      >
        {#snippet description()}
          <p>
            sum of <a
              class="underline"
              href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>customer charges</a
            >
            / number of trips
          </p>
        {/snippet}
      </DataBox>

      <DataBox
        title={$_('organizer.policy-analysis.average-hourly-rate')}
        statistic={backendData?.averageHourlyRate}
        units={$_('organizer.policy-analysis.dollars-per-hour')}
        dollars={true}
      >
        {#snippet description()}
          <p>
            sum of <a
              class="underline"
              href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>account incomes</a
            >
            (with tip) / sum of
            <a class="underline" href={`/organizer/org/${affiliateOrganizationKey}/definitions`}
              >trip durations</a
            >
          </p>
        {/snippet}
      </DataBox>

      <DataBox
        title={$_('organizer.policy-analysis.average-hourly-rate-no-tip')}
        statistic={backendData?.averageHourlyRateNoTip}
        units={$_('organizer.policy-analysis.dollars-per-hour')}
        dollars={true}
      >
        {#snippet description()}
          <p>
            sum of <a
              class="underline"
              href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>account incomes</a
            >
            / sum of
            <a class="underline" href={`/organizer/org/${affiliateOrganizationKey}/definitions`}
              >trip durations</a
            >
          </p>
        {/snippet}
      </DataBox>

      <DataBox
        title={$_('organizer.policy-analysis.average-pay')}
        statistic={backendData?.averageDriverPayPerTrip}
        units={$_('organizer.policy-analysis.dollars-per-trip')}
        dollars={true}
      >
        {#snippet description()}
          <p>
            sum of <a
              class="underline"
              href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>account incomes</a
            > (with tip) / number of trips
          </p>
        {/snippet}
      </DataBox>

      <DataBox
        title={$_('organizer.policy-analysis.average-pay-no-tip')}
        statistic={backendData?.averageDriverPayPerTripNoTip}
        units={$_('organizer.policy-analysis.dollars-per-trip')}
        dollars={true}
      >
        {#snippet description()}
          <p>
            sum of <a
              class="underline"
              href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>account incomes</a
            >
            / number of trips
          </p>
        {/snippet}
      </DataBox>
    </div>
  {:else if !hideStats}
    <p class="text-center text-base-content/40 mt-8 py-8">
      {$_('organizer.policy-analysis.no-data')}
    </p>
  {/if}
</div>
