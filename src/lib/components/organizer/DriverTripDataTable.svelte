<script lang="ts">
  import DownloadCsvData from '@src/lib/components/organizer/DownloadCsvData.svelte';
  import { USDformatter } from '@src/lib/utils';

  let {
    tableActivities,
    filteredActivities,
    driverFullName,
    averageDailyPay,
    getPdfBlobArguments,
    deactivatedDuration,
    annualInterestRate
  } = $props();

  // This is the user's timezone, like America/Denver
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let tableLimit = 100;

  /**
   * Convert a date string to a locale string without seconds
   * @param dateString - The date string to convert, ISO 8601 format
   */
  const dateStringToLocaleStringWithoutSeconds = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
</script>

<div class="grid grid-cols-[2fr_1fr] gap-4 items-end justify-between max-w-4xl mt-4 mb-1">
  <h2 class="font-bold text-xl">
    Reference period trip data ({tableActivities.length.toLocaleString()} trips)
  </h2>
  <DownloadCsvData
    data={filteredActivities}
    driverName={driverFullName}
    {averageDailyPay}
    {getPdfBlobArguments}
    deactivationPeriodDuration={deactivatedDuration}
    {annualInterestRate}
  />
</div>
{#if tableActivities.length > 0}
  <div class="overflow-x-auto relative w-screen lg:px-2" style="left: calc(-50vw + 50%);">
    <table class="table-auto border-collapse border border-gray-400 mx-auto">
      <thead>
        <tr>
          <th class="border border-gray-400 px-2 py-1">Driver Name</th>
          <th class="border border-gray-400 px-2 py-1">Employer</th>
          <th class="border border-gray-400 px-2 py-1 leading-none">
            Start Datetime
            <br />
            <span class="text-xs italic">{timezone}</span>
          </th>
          <th class="border border-gray-400 px-2 py-1 leading-none">
            End Datetime
            <br />
            <span class="text-xs italic">{timezone}</span>
          </th>
          <th class="border border-gray-400 px-2 py-1">Start Latitude</th>
          <th class="border border-gray-400 px-2 py-1">Start Longitude</th>
          <th class="border border-gray-400 px-2 py-1">End Latitude</th>
          <th class="border border-gray-400 px-2 py-1">End Longitude</th>
          <th class="border border-gray-400 px-2 py-1">Base Pay</th>
          <th class="border border-gray-400 px-2 py-1">Total Income</th>
          <th class="border border-gray-400 px-2 py-1">Bonus Pay</th>
          <th class="border border-gray-400 px-2 py-1">Tips</th>
          <th class="border border-gray-400 px-2 py-1">Fees</th>
        </tr>
      </thead>
      <tbody>
        {#each tableActivities.slice(0, tableLimit) as activity}
          <tr>
            <td class="border border-gray-400 px-2 py-1">{driverFullName}</td>
            <td class="border border-gray-400 px-2 py-1">{activity.employer}</td>
            <td class="border border-gray-400 px-2 py-1">
              <!-- toLocaleString will take the UTC timestamp in the database and convert
               it into the user's timezone, which will match their timezone -->
              {activity.start_datetime
                ? dateStringToLocaleStringWithoutSeconds(activity.start_datetime)
                : 'N/A'}</td
            >
            <td class="border border-gray-400 px-2 py-1">
              <!-- toLocaleString will take the UTC timestamp in the database and convert
               it into the user's timezone, which will match their timezone -->
              {activity.end_datetime
                ? dateStringToLocaleStringWithoutSeconds(activity.end_datetime)
                : 'N/A'}</td
            >
            <td class="border border-gray-400 px-2 py-1">{activity.start_location_lat}</td>
            <td class="border border-gray-400 px-2 py-1">{activity.start_location_lng}</td>
            <td class="border border-gray-400 px-2 py-1">{activity.end_location_lat}</td>
            <td class="border border-gray-400 px-2 py-1">{activity.end_location_lng}</td>
            <td class="border border-gray-400 px-2 py-1">
              {activity.income_pay ? USDformatter.format(activity.income_pay) : 'N/A'}
            </td>
            <td class="border border-gray-400 px-2 py-1">
              {activity.income_total ? USDformatter.format(activity.income_total) : 'N/A'}
            </td>
            <td class="border border-gray-400 px-2 py-1">
              {activity.income_bonus ? USDformatter.format(activity.income_bonus) : 'N/A'}
            </td>
            <td class="border border-gray-400 px-2 py-1">
              {activity.income_tips ? USDformatter.format(activity.income_tips) : 'N/A'}
            </td>
            <td class="border border-gray-400 px-2 py-1">
              {activity.income_fees ? USDformatter.format(activity.income_fees) : 'N/A'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if tableActivities.length > tableLimit}
    <div class="w-full flex justify-center my-8 italic">
      <p>Showing first {tableLimit} activities of {tableActivities.length.toLocaleString()}</p>
    </div>
  {/if}
{:else}
  <div class="w-full flex justify-center my-8">
    <p>No activities found</p>
  </div>
{/if}
