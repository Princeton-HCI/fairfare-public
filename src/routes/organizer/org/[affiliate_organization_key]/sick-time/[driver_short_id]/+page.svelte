<script lang="ts">
  import { page } from '$app/state';
  import DateInput from '@src/lib/components/DateInput.svelte';
  import DownloadCsvButton from '@src/lib/components/organizer/dash/DownloadCsvButton.svelte';
  import Svelecte from 'svelecte';
  import { driverHasSynced, getStateAbbrev, states } from '@src/routes/organizer/utils';
  import { title } from '@src/lib/stores/pageinfo';
  import { _ } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import DriverNamePhoneAndEmail from '@src/lib/components/organizer/DriverNamePhoneAndEmail.svelte';
  import InputBox from '@src/lib/components/organizer/dash/InputBox.svelte';
  import DataBox from '@src/lib/components/organizer/dash/DataBox.svelte';
  import type { SickTimeStatsResponse } from '@src/routes/api/organizer/sick_time_stats/+server.js';

  const { data } = $props();
  let driverProfile = data.driverProfile;
  let driverUserId = data.driverId;
  let driverPhone = $derived(driverProfile.phone || '');
  let driverEmail = $derived(driverProfile.email || '');
  let driverFirstName = $derived(driverProfile.first_name || '');
  let driverLastName = $derived(driverProfile.last_initial || '');
  let driverFullName = $derived(`${driverFirstName} ${driverLastName}`);

  let backendData: SickTimeStatsResponse | null = $state(null);

  let errorMessage = '';
  const { affiliate_organization_key: affiliateOrganizationKey } = page.params;

  function formatDate(date: Date) {
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayFormatted = formatDate(yesterday);

  const lastYear = new Date(yesterday);
  lastYear.setFullYear(yesterday.getFullYear() - 1);
  const lastYearFormatted = formatDate(lastYear);

  let resolvedFilterEndDate = $derived.by(() => {
    if (!filterEndDate) return formatDate(yesterday);
    return filterEndDate;
  });
  let resolvedRateEndDate = $derived.by(() => {
    if (!rateEndDate) return formatDate(yesterday);
    return rateEndDate;
  });

  let filterStartDate = $state('');
  let filterEndDate = $state('');
  let rateStartDate = $state('');
  let rateEndDate = $state('');
  let endDateBeforeStartDate = $derived(new Date(filterStartDate) > new Date(filterEndDate));

  let selectedItemStart = $state<string | undefined>(undefined);
  let selectedItemEnd = $state<string | undefined>(undefined);

  let preset = $state<string | undefined>('Washington');
  const setPreset = (scope: string) => {
    preset = scope;
    if (scope === 'Washington') {
      filterStartDate = '2023-01-23';
      filterEndDate = yesterdayFormatted;
      rateStartDate = lastYearFormatted;
      rateEndDate = yesterdayFormatted;
      selectedItemStart = 'Washington';
      selectedItemEnd = 'Washington';
      locationCombiner = 'AND';
    } else {
      filterStartDate = '';
      filterEndDate = '';
      rateStartDate = '';
      rateEndDate = '';
      selectedItemStart = '';
      selectedItemEnd = '';
      locationCombiner = 'OR';
    }
  };

  const stateNames = states.map((state) => state.name);
  let locationCombiner = $state('OR');

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
    if (category === 'all') return [];
    if (category === 'ridehail') return platformsRidehail.map((item) => item.value);
    if (category === 'delivery') return platformsDelivery.map((item) => item.value);
  });

  let isLoading = $state(false);
  let hideStats = $state(false);

  let resolvedStartLocation = $derived.by(() => {
    if (!selectedItemStart) return undefined;
    return getStateAbbrev(selectedItemStart);
  });

  let resolvedEndLocation = $derived.by(() => {
    if (!selectedItemEnd) return undefined;
    return getStateAbbrev(selectedItemEnd);
  });

  onMount(() => {
    filterStartDate = '2023-01-23';
    filterEndDate = yesterdayFormatted;
    rateStartDate = lastYearFormatted;
    rateEndDate = yesterdayFormatted;
    selectedItemStart = 'Washington';
    selectedItemEnd = 'Washington';
    locationCombiner = 'AND';
    fetchData();
  });

  $effect(() => {
    filterStartDate = filterStartDate;
    filterEndDate = filterEndDate;
    rateStartDate = rateStartDate;
    rateEndDate = rateEndDate;
    selectedItemStart = selectedItemStart;
    selectedItemEnd = selectedItemEnd;
    locationCombiner = locationCombiner;
    category = category;
    platform = platform;

    hideStats = true;
  });

  function fetchData() {
    isLoading = true;
    const params = new URLSearchParams({
      filterStartDate,
      filterEndDate: resolvedFilterEndDate,
      rateStartDate,
      rateEndDate: resolvedRateEndDate,
      locationCombiner,
      selectedScope: affiliateOrganizationKey,
      driverUserId
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
    fetch(`/api/organizer/sick_time_stats?${params.toString()}`)
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

  title.set('Organizer | Sick Time');
</script>

{#if errorMessage}
  <p class="text-error">{errorMessage}</p>
{:else}
  <h1 class="font-serif text-2xl font-medium text-base-content">
    {$_('organizer.sick-time.title')}
  </h1>
  <div class="text-sm breadcrumbs self-start w-full mt-2">
    <ul>
      <li>
        <a href={`/organizer/org/${affiliateOrganizationKey}/sick-time`}
          >{$_('organizer.driverProfile.allDrivers')}</a
        >
      </li>
      <li>{driverFullName}</li>
    </ul>
  </div>
  <div class="my-4">
    <DriverNamePhoneAndEmail
      fullName={driverFullName}
      phone={driverPhone}
      email={driverEmail}
      hasSynced={driverHasSynced(driverProfile)}
    />
  </div>

  <div class="flex flex-wrap gap-2 mt-4">
    <button
      class="btn btn-sm {preset === 'Washington' ? 'btn-secondary' : ''}"
      onclick={() => setPreset('Washington')}
    >
      Washington
    </button>
    <button
      class="btn btn-sm {preset === 'Custom' ? 'btn-secondary' : ''}"
      onclick={() => setPreset('Custom')}
    >
      Custom
    </button>
  </div>

  <InputBox
    title={$_('organizer.sick-time.date-filter.title')}
    description={$_('organizer.sick-time.date-filter.description')}
  >
    {#if endDateBeforeStartDate}
      <p class="text-sm text-error">{$_('organizer.sick-time.date-filter.error')}</p>
    {/if}
    <DateInput
      label={$_('organizer.sick-time.date-filter.start')}
      name="filterStartDate"
      max={yesterday}
      bind:value={filterStartDate}
    />
    <DateInput
      label={$_('organizer.sick-time.date-filter.end')}
      name="filterEndDate"
      max={yesterday}
      bind:value={filterEndDate}
    />
  </InputBox>

  <InputBox
    title={$_('organizer.sick-time.rate-date-filter.title')}
    description={$_('organizer.sick-time.date-filter.description')}
  >
    {#if endDateBeforeStartDate}
      <p class="text-sm text-error">{$_('organizer.sick-time.date-filter.error')}</p>
    {/if}
    <DateInput
      label={$_('organizer.sick-time.date-filter.start')}
      name="rateStartDate"
      max={yesterday}
      bind:value={rateStartDate}
    />
    <DateInput
      label={$_('organizer.sick-time.date-filter.end')}
      name="rateEndDate"
      max={yesterday}
      bind:value={rateEndDate}
    />
  </InputBox>

  <InputBox
    title={$_('organizer.sick-time.location-filter.title')}
    description={$_('organizer.sick-time.location-filter.description')}
  >
    <div>
      <div class="flex gap-2">
        <div class="flex items-center gap-2 w-full">
          <p>Starts in:</p>
          <Svelecte
            options={stateNames}
            bind:value={selectedItemStart}
            placeholder={$_('organizer.sick-time.location-filter.state-placeholder')}
          ></Svelecte>
        </div>
        <Svelecte
          class="max-w-min"
          options={['OR', 'AND']}
          searchable={false}
          deselectMode={'none'}
          bind:value={locationCombiner}
        ></Svelecte>
        <div class="flex items-center gap-2 w-full">
          <p>Ends in:</p>
          <Svelecte
            options={stateNames}
            bind:value={selectedItemEnd}
            placeholder={$_('organizer.sick-time.location-filter.state-placeholder')}
          ></Svelecte>
        </div>
      </div>
    </div></InputBox
  >

  <InputBox
    title={$_('organizer.sick-time.platform-filter.title')}
    description={$_('organizer.sick-time.platform-filter.description')}
  >
    <div>
      <div class="flex flex-wrap gap-2 mb-3">
        <button
          class="btn btn-sm {category === 'all' ? 'btn-secondary' : ''}"
          onclick={() => setCategory('all')}
        >
          {$_('organizer.sick-time.platform-filter.all')}
        </button>
        <button
          class="btn btn-sm {category === 'ridehail' ? 'btn-secondary' : ''}"
          onclick={() => setCategory('ridehail')}
        >
          {$_('organizer.sick-time.platform-filter.ridehail')}
        </button>
        <button
          class="btn btn-sm {category === 'delivery' ? 'btn-secondary' : ''}"
          onclick={() => setCategory('delivery')}
        >
          {$_('organizer.sick-time.platform-filter.delivery')}
        </button>
      </div>
      {#if category === 'ridehail'}
        <Svelecte
          options={platformsRidehail}
          searchable={false}
          bind:value={platform}
          placeholder={$_('organizer.sick-time.platform-filter.select-ridehail')}
        />
      {:else if category === 'delivery'}
        <Svelecte
          options={platformsDelivery}
          searchable={false}
          bind:value={platform}
          placeholder={$_('organizer.sick-time.platform-filter.select-delivery')}
        />
      {:else}
        <Svelecte
          options={platformsAll}
          searchable={false}
          bind:value={platform}
          placeholder={$_('organizer.sick-time.platform-filter.select-all')}
        />
      {/if}
    </div>
  </InputBox>

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
      rateStartDateString={rateStartDate}
      rateEndDateString={resolvedRateEndDate}
      {driverUserId}
      driverName={`${driverFirstName}${driverLastName}`}
      startLocation={resolvedStartLocation ?? ''}
      endLocation={resolvedEndLocation ?? ''}
      {locationCombiner}
      platforms={resolvedPlatforms ?? []}
      {affiliateOrganizationKey}
      disabled={!backendData || backendData?.tripsAccrual == 0 || hideStats}
      tool="SICK"
    ></DownloadCsvButton>
  </div>

  {#if isLoading}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {#each Array(4) as _}
        <div class="bg-base-200/50 rounded-lg h-24 animate-pulse"></div>
      {/each}
    </div>
  {:else if backendData && backendData?.tripsAccrual != 0 && !hideStats}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      <DataBox
        title={$_('organizer.sick-time.accrual-trips')}
        statistic={backendData.tripsAccrual}
        round={true}
      ></DataBox>

      <DataBox
        title={$_('organizer.sick-time.rate-trips')}
        statistic={backendData.tripsRate}
        round={true}
      ></DataBox>

      <DataBox
        title={$_('organizer.sick-time.total-sick-time')}
        statistic={backendData.totalEarnedSickTime}
        units={$_('organizer.sick-time.hours')}
        round={true}
      >
        {#snippet description()}
          <p>
            <a class="underline" href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>
              trip durations</a
            > / 40, rounded down
          </p>
        {/snippet}
      </DataBox>

      <DataBox
        title={$_('organizer.sick-time.rate')}
        statistic={backendData.hourlyPaidSickTimeRate}
        round={false}
        dollars={true}
        units={$_('organizer.sick-time.per-hour')}
      >
        {#snippet description()}
          <p>
            sum of <a
              class="underline"
              href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>account income</a
            >
            /
            <a class="underline" href={`/organizer/org/${affiliateOrganizationKey}/definitions`}>
              trip durations</a
            >, from the last 12 months
          </p>
        {/snippet}
      </DataBox>
    </div>
  {:else if !hideStats}
    <p class="text-center text-base-content/40 mt-8 py-8">{$_('organizer.sick-time.no-data')}</p>
  {/if}
{/if}
