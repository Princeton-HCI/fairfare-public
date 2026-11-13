<script lang="ts">
  import { page } from '$app/state';
  import { _ } from 'svelte-i18n';
  import { hasCapability } from '@src/lib/rbac';

  import DriverReportPreview from '@src/lib/components/organizer/DriverReportPreview.svelte';
  import DriverNamePhoneAndEmail from '@src/lib/components/organizer/DriverNamePhoneAndEmail.svelte';
  import { title } from '@src/lib/stores/pageinfo';
  import { convertDateToUTC } from '@src/lib/utils';
  import type { MakeDriverReportPdfBlobArguments } from '@src/routes/organizer/driver_report_pdf/makeDriverReportPdfBlob';
  import DriverTripDataTable from '@src/lib/components/organizer/DriverTripDataTable.svelte';
  import { driverHasSynced, type ProfileWithDetails } from '@src/routes/organizer/utils';
  import type { FilteredActivitiesResponse } from '@src/routes/api/organizer/filtered_driver_activities/+server';
  import DateInput from '@src/lib/components/DateInput.svelte';
  import { toast } from '@src/lib/toasts';
  import type { PeriodMetrics, MissedOpportunities } from '@src/lib/onlineTimeEstimation';
  import InputBox from '@src/lib/components/organizer/dash/InputBox.svelte';

  type DriverActivity = SupabaseRows['argyle_driver_activities'];

  type ToolMode = 'lost-wages' | 'deactivation';

  interface Props {
    data: {
      mostRecentOneHundredActivities: DriverActivity[];
      allEmployers: string[];
      driverProfile: ProfileWithDetails;
      driverLifetimeTripsCount: number;
    };
  }

  let { data }: Props = $props();

  const { affiliate_organization_key: affiliateOrganizationKey, driver_short_id: driverShortId } =
    page.params;

  let errorMessage = '';

  const initialMode =
    page.url.searchParams.get('mode') === 'deactivation' ? 'deactivation' : 'lost-wages';
  let toolMode: ToolMode = $state(initialMode);

  const urlDeactivationStart = page.url.searchParams.get('deactivationStart');
  const urlDeactivationEnd = page.url.searchParams.get('deactivationEnd');

  let driverProfile = data.driverProfile;
  let backendData: FilteredActivitiesResponse | undefined = $state(undefined);

  let deactivationToolData: {
    beforeMetrics: PeriodMetrics;
    deactivationMetrics: PeriodMetrics;
    afterMetrics: PeriodMetrics;
    missed: MissedOpportunities;
    deactivationPeriodString: string;
  } | null = $state(null);
  let deactivationToolLoading = $state(false);
  let deactivationToolError = $state('');
  let isDownloadingDeactivationReport = $state(false);
  const canExport = $derived(
    hasCapability(page.data.roles, 'org:export_driver_data', affiliateOrganizationKey)
  );

  title.set('Organizer | Lost Wages');

  let getPdfBlobArguments: MakeDriverReportPdfBlobArguments | undefined = $state(undefined);

  let selectedEmployer = $state(null) as string | null;
  let isLoading = $state(false);
  let activitiesFilterEndDate = $state('');

  let deactivatedDate = $state(urlDeactivationStart || '');
  let reactivatedDate = $state(urlDeactivationEnd || '');
  let demandLetterDate = $state('');

  $effect(() => {
    if (deactivatedDate) {
      const [year, month, day] = deactivatedDate.split('-').map(Number);
      const deactivated = new Date(Date.UTC(year, month - 1, day));

      const twelveWeeksBeforeDeactivation = new Date(deactivated);
      twelveWeeksBeforeDeactivation.setUTCDate(deactivated.getUTCDate() - 12 * 7);
      activitiesFilterStartDate = twelveWeeksBeforeDeactivation.toISOString().split('T')[0];

      const oneDayBeforeDeactivatedInMs = deactivated.getTime() - 1000 * 60 * 60 * 24;
      const oneDayBeforeDeactivated = new Date(oneDayBeforeDeactivatedInMs);
      activitiesFilterEndDate = convertDateToUTC(oneDayBeforeDeactivated);
    }
  });

  $effect(() => {
    getPdfBlobArguments = driverProfile &&
      backendData && {
        driverFullName,
        driverEmail,
        driverPhone,
        referencePeriodString: backendData.referencePeriod,
        deactivationPeriodString: backendData.deactivationPeriod,
        totalNumberOfTrips: backendData.totalNumberOfTrips,
        averageDailyPayString: backendData.averageDailyPayString,
        grossEstimatedLostPay: backendData.grossEstimatedLostPay,
        grossEstimatedLostPayWithInterest: backendData.grossEstimatedLostPayWithInterest,
        annualInterestRateAsString: backendData.annualInterestRate,
        deactivationPeriodDurationString: backendData.periodOfDeactivation,
        interestPeriod: backendData.interestPeriod,
        selectedEmployer,
        demandLetterDate: backendData.demandLetterDate
      };
  });
  let activitiesFilterStartDate = $state('');

  let filteredActivitiesRequestId = 0; // Ignore stale responses when dates/platform change

  $effect(() => {
    if (toolMode === 'lost-wages' && activitiesFilterStartDate && activitiesFilterEndDate) {
      const controller = new AbortController();
      const requestId = ++filteredActivitiesRequestId;

      isLoading = true;
      const params = new URLSearchParams({
        organizationKey: affiliateOrganizationKey ?? '',
        driverUserId: driverProfile.user_id,
        activitiesFilterStartDate,
        activitiesFilterEndDate,
        deactivatedDate,
        reactivatedDate,
        demandLetterDate,
        annualInterestRate: annualInterestRate.toString(),
        selectedEmployer: selectedEmployer || ''
      });
      fetch(`/api/organizer/filtered_driver_activities?${params.toString()}`, {
        signal: controller.signal
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
        })
        .then((data) => {
          if (requestId !== filteredActivitiesRequestId) return;
          if (data) backendData = data;
        })
        .catch((error) => {
          if (requestId !== filteredActivitiesRequestId || error.name === 'AbortError') return;
        })
        .finally(() => {
          if (requestId === filteredActivitiesRequestId) {
            isLoading = false;
          }
        });

      return () => controller.abort();
    }
  });
  let driverPhone = $derived(driverProfile.phone || '');
  let driverEmail = $derived(driverProfile.email || '');
  let driverFirstName = $derived(driverProfile.first_name || '');
  let driverLastName = $derived(driverProfile.last_initial || '');
  let driverFullName = $derived(`${driverFirstName} ${driverLastName}`);

  let deactivatedDuration = $derived(
    (() => {
      if (deactivatedDate && reactivatedDate) {
        const deactivated = new Date(deactivatedDate);
        const reactivated = new Date(reactivatedDate);
        const durationInMilliseconds = reactivated.getTime() - deactivated.getTime();
        const durationInDays = Math.floor(durationInMilliseconds / (1000 * 60 * 60 * 24)) + 1;
        return durationInDays;
      } else if (deactivatedDate) {
        const todayAsUTC = new Date(convertDateToUTC(new Date()));
        const deactivated = new Date(deactivatedDate);
        const durationInMilliseconds = todayAsUTC.getTime() - deactivated.getTime();
        const durationInDays = Math.floor(durationInMilliseconds / (1000 * 60 * 60 * 24)) + 1;
        return durationInDays;
      }
      return 0;
    })()
  );
  let endDateBeforeStartDate = $derived(
    new Date(activitiesFilterStartDate) > new Date(activitiesFilterEndDate)
  );
  let referenceEndAfterDeactivation = $derived(
    new Date(activitiesFilterEndDate) >= new Date(deactivatedDate)
  );
  let startDate = $derived(new Date(activitiesFilterStartDate));
  let endDate = $derived(new Date(activitiesFilterEndDate));
  let annualInterestRate = $state(12);
  let referencePeriodDuration = $derived(
    Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  let availableEmployers = data.allEmployers;
  let platformOptions = $derived(
    toolMode === 'deactivation' ? ['uber', 'lyft'] : availableEmployers
  );

  $effect(() => {
    if (
      toolMode === 'deactivation' &&
      selectedEmployer != null &&
      selectedEmployer !== 'uber' &&
      selectedEmployer !== 'lyft'
    ) {
      selectedEmployer = null;
    }
  });

  let missingInputData = $derived(
    !deactivatedDate || !activitiesFilterStartDate || !activitiesFilterEndDate
  );

  let missingDeactivationInput = $derived(!deactivatedDate || !reactivatedDate);

  let deactivationRequestId = 0; // Ignore stale responses when dates/platform change

  $effect(() => {
    if (toolMode === 'deactivation' && deactivatedDate && reactivatedDate) {
      const controller = new AbortController();
      const requestId = ++deactivationRequestId;

      deactivationToolLoading = true;
      deactivationToolError = '';
      deactivationToolData = null;

      fetch('/api/organizer/deactivation-tool-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverShortId,
          driverEmail,
          platform: selectedEmployer || 'all',
          deactivationStart: deactivatedDate,
          deactivationEnd: reactivatedDate,
          affiliateOrganizationKey
        }),
        signal: controller.signal
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to fetch deactivation data');
          }
          return response.json();
        })
        .then((data) => {
          if (requestId !== deactivationRequestId) return;
          if (data) {
            if (data.error) {
              deactivationToolError = data.error;
            }
            if (data.beforeMetrics) {
              deactivationToolData = data;
            }
          }
        })
        .catch((error) => {
          if (requestId !== deactivationRequestId) return;
          if (error.name !== 'AbortError') {
            deactivationToolError = error.message || 'Failed to load deactivation data';
          }
        })
        .finally(() => {
          if (requestId === deactivationRequestId) {
            deactivationToolLoading = false;
          }
        });

      return () => controller.abort();
    }
  });

  async function downloadDeactivationReport() {
    if (!deactivatedDate || !reactivatedDate) {
      toast({ text: 'Please enter deactivation start and end dates', type: 'error' });
      return;
    }

    isDownloadingDeactivationReport = true;
    try {
      const response = await fetch('/api/organizer/download-deactivation-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverShortId,
          driverEmail,
          platform: selectedEmployer || 'all',
          deactivationStart: deactivatedDate,
          deactivationEnd: reactivatedDate,
          affiliateOrganizationKey
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'deactivation_report.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      link.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ text: `Failed to download report: ${errorMessage}`, type: 'error' });
    } finally {
      isDownloadingDeactivationReport = false;
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function formatNumber(num: number, decimals = 1): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  }
</script>

{#if errorMessage}
  <p class="text-error">{errorMessage}</p>
{:else}
  <h1 class="font-serif text-2xl font-medium text-base-content">Lost Wages Report</h1>
  <div class="text-sm breadcrumbs self-start w-full mt-2">
    <ul>
      <li>
        <a href={`/organizer/org/${affiliateOrganizationKey}/lost-wages`}
          >{$_('organizer.driverProfile.allDrivers')}</a
        >
      </li>
      <li>{driverFullName}</li>
    </ul>
  </div>

  <DriverNamePhoneAndEmail
    fullName={driverFullName}
    phone={driverPhone}
    email={driverEmail}
    hasSynced={driverHasSynced(driverProfile)}
  />

  <div class="flex gap-2 flex-wrap mt-4 mb-4">
    <button
      type="button"
      class="btn btn-sm {toolMode === 'lost-wages' ? 'btn-secondary' : ''}"
      onclick={() => (toolMode = 'lost-wages')}
    >
      {$_('organizer.driverProfile.lostWagesCalculator')}
    </button>
    <button
      type="button"
      class="btn btn-sm {toolMode === 'deactivation' ? 'btn-secondary' : ''}"
      onclick={() => (toolMode = 'deactivation')}
    >
      {$_('organizer.driverProfile.hourlyPayReport')}
    </button>
  </div>

  <form class="mb-2">
    <InputBox title={$_('organizer.driverProfile.deactivationPeriod')}>
      {#if toolMode === 'deactivation'}
        {#if !deactivatedDate || !reactivatedDate}
          <p class="text-sm">{$_('organizer.driverProfile.enterStartAndEndDates')}</p>
        {:else if deactivatedDuration > 0}
          <p class="text-sm">
            {$_('organizer.driverProfile.deactivatedForDays', {
              values: { days: deactivatedDuration }
            })}
          </p>
        {:else}
          <p class="text-sm text-error">
            {$_('organizer.driverProfile.deactivationRangeNegative')}
          </p>
        {/if}
      {:else if !!deactivatedDate && !reactivatedDate}
        <p class="text-sm">{$_('organizer.driverProfile.noReactivationDateChosen')}</p>
      {:else if deactivatedDuration === 0}
        <p class="text-sm">{$_('organizer.driverProfile.whenWasDriverDeactivated')}</p>
      {:else if deactivatedDuration > 0}
        <p class="text-sm">
          {$_('organizer.driverProfile.deactivatedForDays', {
            values: { days: deactivatedDuration }
          })}
        </p>
      {:else}
        <p class="text-sm text-error">{$_('organizer.driverProfile.deactivationRangeNegative')}</p>
      {/if}

      <DateInput
        label={$_('organizer.driverProfile.deactivationStart')}
        name="deactivatedDate"
        bind:value={deactivatedDate}
      />
      <DateInput
        label={toolMode === 'deactivation'
          ? $_('organizer.driverProfile.deactivationEnd')
          : $_('organizer.driverProfile.reactivationDateOptional')}
        name="reactivatedDate"
        bind:value={reactivatedDate}
      />
      {#if toolMode === 'lost-wages'}
        <DateInput
          label={$_('organizer.driverProfile.demandArbitrationDateOptional')}
          name="demandLetterDate"
          bind:value={demandLetterDate}
          description={$_('organizer.driverProfile.interestDateDescription')}
        />
      {:else}
        <div class="opacity-50 pointer-events-none">
          <DateInput
            label={$_('organizer.driverProfile.demandArbitrationDateOptional')}
            name="demandLetterDate"
            bind:value={demandLetterDate}
            description={$_('organizer.driverProfile.notUsedForHourlyPayReport')}
          />
        </div>
      {/if}
    </InputBox>

    <InputBox title={$_('organizer.driverProfile.referencePeriod')}>
      {#if toolMode === 'deactivation'}
        <p class="text-sm text-gray-500">
          {$_('organizer.driverProfile.referenceAutoCalculated')}
        </p>
        <div class="opacity-50 pointer-events-none">
          <DateInput
            label={$_('organizer.driverProfile.referenceStart')}
            name="activitiesFilterStartDate"
            bind:value={activitiesFilterStartDate}
          />
          <DateInput
            label={$_('organizer.driverProfile.referenceEnd')}
            name="activitiesFilterEndDate"
            bind:value={activitiesFilterEndDate}
          />
        </div>
      {:else}
        {#if endDateBeforeStartDate}
          <p class="text-sm text-error">{$_('organizer.driverProfile.endDateAfterStart')}</p>
        {:else if referenceEndAfterDeactivation}
          <p class="text-sm text-error">
            {$_('organizer.driverProfile.endDateBeforeDeactivation')}
          </p>
        {:else if activitiesFilterStartDate && activitiesFilterEndDate}
          <p class="text-sm">
            {$_('organizer.driverProfile.referencePeriodDays', {
              values: { days: referencePeriodDuration }
            })}
          </p>
        {:else}
          <p class="text-sm">{$_('organizer.driverProfile.referenceForBaseline')}</p>
        {/if}
        <DateInput
          label={$_('organizer.driverProfile.referenceStart')}
          name="activitiesFilterStartDate"
          bind:value={activitiesFilterStartDate}
        />
        <DateInput
          label={$_('organizer.driverProfile.referenceEnd')}
          name="activitiesFilterEndDate"
          bind:value={activitiesFilterEndDate}
        />
        <small class="block text-xs text-gray-500">
          {$_('organizer.driverProfile.defaultReferencePeriod')}
        </small>
      {/if}
    </InputBox>

    <InputBox
      title={$_('organizer.driverProfile.platform')}
      description={$_('organizer.driverProfile.platformDescription')}
    >
      <div class="flex flex-col gap-0.5 font-medium">
        <label>
          <input
            type="radio"
            bind:group={selectedEmployer}
            value={null}
            onchange={() => (selectedEmployer = null)}
          />
          {$_('organizer.driverProfile.allEmployers')}
        </label>

        {#each platformOptions as employer}
          <label>
            <input type="radio" bind:group={selectedEmployer} value={employer} />
            {employer}
          </label>
        {/each}
      </div>
    </InputBox>

    {#if toolMode === 'lost-wages'}
      <InputBox
        title={$_('organizer.driverProfile.interestRate')}
        description={$_('organizer.driverProfile.interestRateDescription')}
      >
        <label class="font-medium flex justify-between">
          {$_('organizer.driverProfile.annualInterestRate')}
          <div>
            <input
              type="number"
              step="1"
              bind:value={annualInterestRate}
              class="font-normal w-12 border border-black"
            />
            %
          </div>
        </label>
      </InputBox>
    {:else}
      <div class="opacity-50 pointer-events-none">
        <InputBox
          title={$_('organizer.driverProfile.interestRate')}
          description={$_('organizer.driverProfile.notUsedForHourlyPayReport')}
        >
          <label class="font-medium flex justify-between">
            {$_('organizer.driverProfile.annualInterestRate')}
            <div>
              <input
                type="number"
                step="1"
                bind:value={annualInterestRate}
                class="font-normal w-12 border border-black"
                disabled
              />
              %
            </div>
          </label>
        </InputBox>
      </div>
    {/if}
  </form>

  {#if toolMode === 'lost-wages'}
    <DriverReportPreview
      {backendData}
      {driverEmail}
      {driverFullName}
      {driverPhone}
      {isLoading}
      {missingInputData}
      {selectedEmployer}
    />

    <DriverTripDataTable
      averageDailyPay={backendData?.averageDailyPay}
      {driverFullName}
      {getPdfBlobArguments}
      {deactivatedDuration}
      {annualInterestRate}
      driverUserId={driverProfile.user_id}
      startDateString={activitiesFilterStartDate}
      endDateString={activitiesFilterEndDate}
      {affiliateOrganizationKey}
      {selectedEmployer}
    />
  {:else}
    <div class="max-w-lg mx-auto">
      <div class="flex flex-row items-center gap-2 justify-between">
        <h2 class="font-bold text-lg">{$_('organizer.driverProfile.hourlyPayReport')}</h2>
        {#if canExport}
          <button
            class="btn btn-neutral"
            onclick={downloadDeactivationReport}
            disabled={isDownloadingDeactivationReport ||
              missingDeactivationInput ||
              deactivationToolLoading}
          >
            {#if isDownloadingDeactivationReport}
              <span class="loading loading-spinner loading-sm mr-2"></span>
              {$_('organizer.driverProfile.downloading')}
            {:else}
              {$_('organizer.driverProfile.downloadReport')}
            {/if}
          </button>
        {/if}
      </div>

      <div class="my-2 p-4 rounded-lg bg-white shadow-sm">
        {#if missingDeactivationInput}
          <div class="h-64 flex items-center justify-center">
            <p class="text-error">{$_('organizer.driverProfile.pleaseEnterDeactivationDates')}</p>
          </div>
        {:else if deactivationToolLoading}
          <div class="h-64 flex items-center justify-center">
            <p>{$_('organizer.driverProfile.loadingHourlyPayReport')}</p>
          </div>
        {:else if deactivationToolError}
          <div class="flex flex-col gap-2 p-4">
            {#if deactivationToolError === 'No activities found for this period'}
              <h3 class="font-bold text-gray-800">
                {$_('organizer.driverProfile.noActivityDataTitle')}
              </h3>
              <p class="text-sm text-gray-600">
                {$_('organizer.driverProfile.noActivityDataBody')}
              </p>
            {:else}
              <h3 class="font-bold text-gray-800">
                {$_('organizer.driverProfile.errorLoadingReport')}
              </h3>
              <p class="text-error">{deactivationToolError}</p>
              <p class="text-sm text-gray-500">
                {$_('organizer.driverProfile.reportCanStillBeDownloaded')}
              </p>
            {/if}
          </div>
        {:else if deactivationToolData}
          <DriverNamePhoneAndEmail
            fullName={driverFullName}
            email={driverEmail}
            phone={driverPhone}
            hasSynced={false}
          />

          <div class="h-1"></div>
          <p>
            {$_('organizer.driverProfile.deactivationPeriod')}:
            <b class="font-bold">{deactivationToolData.deactivationPeriodString}</b>
          </p>
          <br />

          {#if deactivationToolData.missed.missedHours > 0}
            <div class="bg-yellow-50 border border-yellow-200 p-3 mb-4 rounded">
              <h3 class="font-bold mb-2">
                {$_('organizer.driverProfile.estimatedMissedOpportunities')}
              </h3>
              <p>
                {$_('organizer.driverProfile.estimatedMissedHours')}
                <b class="font-bold">{formatNumber(deactivationToolData.missed.missedHours)}</b>
              </p>
              <p>
                {$_('organizer.driverProfile.estimatedMissedEarnings')}
                <b class="font-bold">{formatCurrency(deactivationToolData.missed.missedEarnings)}</b
                >
              </p>
              <p class="text-xs text-gray-500 mt-2">
                {$_('organizer.driverProfile.basedOnBaselineActivity')}
              </p>
            </div>
          {:else if deactivationToolData.missed.baselineDailyHours === 0}
            <div class="bg-gray-50 border border-gray-200 p-3 mb-4 rounded">
              <h3 class="font-bold mb-2">
                {$_('organizer.driverProfile.noMissedOpportunitiesDetected')}
              </h3>
              <p class="text-sm font-medium text-gray-700 mb-1">
                {$_('organizer.driverProfile.insufficientBaselineData')}
              </p>
              <p class="text-sm text-gray-600">
                {$_('organizer.driverProfile.insufficientBaselineBody')}
              </p>
            </div>
          {:else}
            <div class="bg-gray-50 border border-gray-200 p-3 mb-4 rounded">
              <h3 class="font-bold mb-2">
                {$_('organizer.driverProfile.noMissedOpportunitiesDetected')}
              </h3>
              <p class="text-sm font-medium text-gray-700 mb-1">
                {$_('organizer.driverProfile.activitySimilarToBaseline')}
              </p>
              <p class="text-sm text-gray-600">
                {$_('organizer.driverProfile.activitySimilarToBaselineBody')}
              </p>
            </div>
          {/if}

          <p class="text-sm text-gray-500 mt-4">
            {$_('organizer.driverProfile.estimatesDisclaimer')}
          </p>
        {:else}
          <div class="h-64 flex items-center justify-center">
            <p class="text-gray-500">{$_('organizer.driverProfile.enterDatesForEstimate')}</p>
          </div>
        {/if}
      </div>

      <div class="bg-base-200/30 p-4 mt-4 rounded-lg">
        <h3 class="font-bold text-sm mb-2">{$_('organizer.driverProfile.aboutHourlyPayReport')}</h3>
        <p class="text-xs text-gray-600">
          {$_('organizer.driverProfile.aboutHourlyPayReportBody')}
        </p>
      </div>
    </div>
  {/if}
{/if}
