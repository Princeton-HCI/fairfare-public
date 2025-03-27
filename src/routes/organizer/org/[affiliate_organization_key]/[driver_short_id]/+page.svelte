<script lang="ts">
  import { page } from '$app/state';

  import DriverReportPreview from '@src/lib/components/organizer/DriverReportPreview.svelte';
  import DriverNamePhoneAndEmail from '@src/lib/components/organizer/DriverNamePhoneAndEmail.svelte';
  import { title } from '@src/lib/stores/pageinfo';
  import { convertDateToUTC, USDformatter } from '@src/lib/utils';
  import type { GetPdfBlobArguments } from '@src/lib/components/organizer/getPdfBlob';
  import InputBox from './InputBox.svelte';
  import {
    calculateGrossEstimatedLostPay,
    calculateGrossEstimatedLostPayWithInterest
  } from '@src/lib/components/organizer/calculateGrossEstimatesLostPay';
  import DriverTripDataTable from '@src/lib/components/organizer/DriverTripDataTable.svelte';
  import { driverHasSynced, type ProfileWithDetails } from '@src/routes/organizer/utils';

  type DriverActivity = SupabaseRows['argyle_driver_activities'];

  interface Props {
    data: {
      activities: DriverActivity[];
      driverProfile: ProfileWithDetails;
    };
  }

  let { data }: Props = $props();

  const { affiliate_organization_key: affiliateOrganizationKey } = page.params;

  let errorMessage = '';

  let allActivities = data.activities;
  let driverProfile = data.driverProfile;

  title.set('Organizer | Driver Profile');

  let getPdfBlobArguments: GetPdfBlobArguments | undefined = $state(undefined);

  let selectedEmployer = $state(null);

  let allActivitiesFilteredByEmployer = $derived(
    allActivities.filter((activity) => {
      if (selectedEmployer) {
        return activity.employer === selectedEmployer;
      }
      return true;
    })
  );
  let activitiesFilterEndDate = $state('');

  let deactivatedDate = $state('');

  // here we set the default reference period to 12 weeks prior to the deactivation date
  // activitiesFilterStartDate is set to 12 weeks before the deactivated date,
  // activitiesFilterEndDate is set to one day before the deactivation date

  $effect(() => {
    if (deactivatedDate) {
      const deactivated = new Date(deactivatedDate);
      const twelveWeeksBeforeDeactivation = new Date(deactivated);
      twelveWeeksBeforeDeactivation.setDate(deactivated.getUTCDate() - 85);
      activitiesFilterStartDate = twelveWeeksBeforeDeactivation.toISOString().split('T')[0];

      const oneDayBeforeDeactivatedInMs = deactivated.getTime() - 1000 * 60 * 60 * 24;
      const oneDayBeforeDeactivated = new Date(oneDayBeforeDeactivatedInMs);
      // save as utc, yyyy-MM-dd
      activitiesFilterEndDate = convertDateToUTC(oneDayBeforeDeactivated);
    }
  });
  $effect(() => {
    getPdfBlobArguments = driverProfile && {
      driverFullName,
      driverEmail,
      driverPhone,
      referencePeriodString,
      deactivationPeriodString,
      totalNumberOfTrips,
      averageDailyPayString,
      grossEstimatedLostPay,
      grossEstimatedLostPayWithInterest,
      annualInterestRateAsString,
      deactivationPeriodDurationString,
      selectedEmployer
    };
  });
  let activitiesFilterStartDate = $state('');

  let filteredActivities = $derived(
    allActivitiesFilteredByEmployer.filter((activity) => {
      // make this date at the very end of the day to include all activities on that day
      const activitiesFilterEndDateString = activitiesFilterEndDate + 'T23:59:59.999Z';
      if (!activity.start_datetime || !activity.end_datetime) {
        return false;
      }
      // handle only start date
      if (activitiesFilterStartDate && !activitiesFilterEndDate) {
        return activity.start_datetime >= activitiesFilterStartDate;
      }
      // handle only end date
      if (!activitiesFilterStartDate && activitiesFilterEndDate) {
        return activity.end_datetime <= activitiesFilterEndDateString;
      }
      // handle both start and end date
      if (activitiesFilterStartDate && activitiesFilterEndDate) {
        return (
          activity.start_datetime >= activitiesFilterStartDate &&
          activity.end_datetime <= activitiesFilterEndDateString
        );
      }
      // keep only where employer matches selected employer if not null
      if (selectedEmployer) {
        return activity.employer === selectedEmployer;
      }
      return true;
    })
  );
  let driverPhone = $derived(driverProfile?.phone || '');
  let driverEmail = $derived(driverProfile?.email || '');
  let driverFirstName = $derived(driverProfile?.first_name || '');
  let driverLastName = $derived(driverProfile?.last_name || '');
  let driverFullName = $derived(`${driverFirstName} ${driverLastName}`);
  let reactivatedDate = $state('');

  let deactivatedDuration = $derived(
    (() => {
      if (deactivatedDate && reactivatedDate) {
        const deactivated = new Date(deactivatedDate);
        const reactivated = new Date(reactivatedDate);
        // @ts-expect-error The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.ts(2362)
        const durationInMilliseconds = reactivated - deactivated;
        const durationInDays = Math.floor(durationInMilliseconds / (1000 * 60 * 60 * 24));
        return durationInDays;
      } else if (deactivatedDate) {
        const todayAsUTC = new Date(convertDateToUTC(new Date()));
        const deactivated = new Date(deactivatedDate);
        // @ts-expect-error The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.ts(2362)
        const durationInMilliseconds = todayAsUTC - deactivated;
        const durationInDays = Math.floor(durationInMilliseconds / (1000 * 60 * 60 * 24));
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
  // note that this is an annual interest rate, in %
  let referencePeriodDuration = $derived(
    (endDate.getTime() - startDate.getTime()) / (60 * 60 * 24 * 1000) + 1
  );
  let totalIncome = $derived(
    filteredActivities
      .filter((activity) => activity.income_total !== null)
      .reduce((total, activity) => {
        // @ts-expect-error 'activity.income_total' is possibly 'null'.ts(18047) - we filter out nulls above
        return total + activity.income_total;
      }, 0)
  );
  let averageDailyPay = $derived(totalIncome / referencePeriodDuration);
  let filteredEmployers = $derived(
    allActivities
      .map((activity) => activity.employer)
      .filter((employer, index, self) => self.indexOf(employer) === index)
  );
  let deactivated = $derived(new Date(deactivatedDate));
  let reactivated = $derived(new Date(reactivatedDate));
  // @ts-expect-error Argument of type 'Date' is not assignable to parameter of type 'number'.ts(2345)
  let isOngoing = $derived(!(reactivated instanceof Date && !isNaN(reactivated)));
  let deactivationPeriodDurationString = $derived(
    isOngoing
      ? `(${deactivatedDuration.toLocaleString()} days, to date)`
      : `(${deactivatedDuration.toLocaleString()} days)`
  );
  let referencePeriodString = $derived(
    `${convertDateToUTC(startDate)} – ${convertDateToUTC(
      endDate
    )} ${deactivationPeriodDurationString}`
  );
  let deactivationPeriodString = $derived(
    isOngoing
      ? `${convertDateToUTC(deactivated)} – present`
      : `${convertDateToUTC(deactivated)} – ${convertDateToUTC(reactivated)}`
  );
  let totalNumberOfTrips = $derived(filteredActivities.length.toLocaleString());
  let grossEstimatedLostPayAmountOnly = $derived(
    USDformatter.format(calculateGrossEstimatedLostPay(averageDailyPay, deactivatedDuration))
  );
  let grossEstimatedLostPay = $derived(
    isOngoing ? grossEstimatedLostPayAmountOnly + ' (to date)' : grossEstimatedLostPayAmountOnly
  );
  let grossEstimatedLostPayWithInterestAmountOnly = $derived(
    USDformatter.format(
      calculateGrossEstimatedLostPayWithInterest(
        averageDailyPay,
        deactivatedDuration,
        annualInterestRate
      )
    )
  );
  let grossEstimatedLostPayWithInterest = $derived(
    isOngoing
      ? grossEstimatedLostPayWithInterestAmountOnly + ' (to date)'
      : grossEstimatedLostPayWithInterestAmountOnly
  );
  let averageDailyPayString = $derived(averageDailyPay ? USDformatter.format(averageDailyPay) : '');
  let annualInterestRateAsString = $derived(`${annualInterestRate}%`);
  let missingInputData = $derived(
    !deactivatedDate || !activitiesFilterStartDate || !activitiesFilterEndDate
  );
</script>

{#if errorMessage}
  <p class="text-error">{errorMessage}</p>
{:else}
  <div class="text-sm breadcrumbs self-start max-w-4xl w-4xl w-full">
    <ul>
      <li><a href={`/organizer/org/${affiliateOrganizationKey}`}>All Drivers</a></li>
      <li>{driverFullName}</li>
    </ul>
  </div>

  <div class="mx-auto max-w-lg mb-4">
    <DriverNamePhoneAndEmail
      fullName={driverFullName}
      phone={driverPhone}
      email={driverEmail}
      hasSynced={driverHasSynced(driverProfile)}
    />
  </div>

  <form class="mb-2 max-w-lg mx-auto">
    <InputBox title="Deactivation period">
      {#if !!deactivatedDate && !reactivatedDate}
        <p class="text-sm">No reactivation date chosen. The driver is still deactivated.</p>
      {:else if deactivatedDuration === 0}
        <p class="text-sm">When was the driver deactivated?</p>
      {:else if deactivatedDuration > 0}
        <p class="text-sm">Deactivated for {deactivatedDuration} days</p>
      {:else}
        <p class="text-sm text-error">Deactivation range cannot be negative</p>
      {/if}
      <div class="mb-1">
        <label for="deactivatedDate" class="font-medium">Deactivated</label>
        <input type="date" name="deactivatedDate" bind:value={deactivatedDate} />
      </div>
      <div>
        <label for="reactivatedDate" class="font-medium">Reactivated</label>
        <input type="date" name="reactivatedDate" bind:value={reactivatedDate} />
      </div>
    </InputBox>

    <InputBox title="Reference period">
      {#if endDateBeforeStartDate}
        <p class="text-sm text-error">End date must be after start date</p>
      {:else if referenceEndAfterDeactivation}
        <p class="text-sm text-error">End date must be before deactivation date</p>
      {:else if activitiesFilterStartDate && activitiesFilterEndDate}
        <p class="text-sm">Reference period of {referencePeriodDuration} days</p>
      {:else}
        <p class="text-sm">When is the reference for the driver's baseline activity?</p>
      {/if}
      <div class="mb-1">
        <label for="activitiesFilterStartDate" class="font-medium">Reference Start</label>
        <input
          type="date"
          name="activitiesFilterStartDate"
          bind:value={activitiesFilterStartDate}
        />
      </div>
      <div>
        <label for="activitiesFilterEndDate" class="font-medium">Reference End</label>
        <input type="date" name="activitiesFilterEndDate" bind:value={activitiesFilterEndDate} />
      </div>
      <small class="block text-xs text-gray-500">
        The default reference period is the 12 weeks prior to the deactivation date
      </small>
    </InputBox>

    <InputBox title="Platform" description="For which platform is the report?">
      <!-- Add your radio buttons and other content here -->
      <div class="flex flex-col gap-0.5 font-medium">
        <!-- Radio button for 'All' option -->
        <label>
          <input
            type="radio"
            bind:group={selectedEmployer}
            value={null}
            onchange={() => (selectedEmployer = null)}
          />
          All employers
        </label>

        <!-- Radio buttons for filtered employers -->
        {#each filteredEmployers as employer}
          <label>
            <input type="radio" bind:group={selectedEmployer} value={employer} />
            {employer}
          </label>
        {/each}
      </div>
    </InputBox>

    <InputBox title="Interest rate" description="Choose an interest rate for lost pay">
      <label class="font-medium">
        Annual interest rate
        <input type="number" step="1" bind:value={annualInterestRate} class="font-normal w-12" />
        %
      </label></InputBox
    >
  </form>

  <DriverReportPreview
    {referencePeriodString}
    {deactivationPeriodString}
    {totalNumberOfTrips}
    {averageDailyPayString}
    {grossEstimatedLostPay}
    {grossEstimatedLostPayWithInterest}
    {annualInterestRateAsString}
    {deactivationPeriodDurationString}
    {driverFullName}
    {driverEmail}
    {driverPhone}
    {selectedEmployer}
    {getPdfBlobArguments}
    {missingInputData}
  />

  <DriverTripDataTable
    tableActivities={filteredActivities}
    {filteredActivities}
    {driverFullName}
    {averageDailyPay}
    {getPdfBlobArguments}
    {deactivatedDuration}
    {annualInterestRate}
  />
{/if}
