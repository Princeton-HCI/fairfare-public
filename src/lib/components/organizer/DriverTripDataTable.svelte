<script lang="ts">
  import DriverDataDownloadButtons from '@src/lib/components/organizer/DriverDataDownloadButtons.svelte';
  import { formatDriverNameForDownload } from '@src/lib/nameUtils';

  let {
    driverFullName,
    averageDailyPay,
    getPdfBlobArguments,
    deactivatedDuration,
    annualInterestRate,
    driverUserId,
    startDateString,
    endDateString,
    selectedEmployer,
    affiliateOrganizationKey
  } = $props();
</script>

<DriverDataDownloadButtons
  driverName={formatDriverNameForDownload(driverFullName)}
  {averageDailyPay}
  {getPdfBlobArguments}
  deactivationPeriodDuration={deactivatedDuration}
  {annualInterestRate}
  {driverUserId}
  {startDateString}
  {endDateString}
  {selectedEmployer}
  {affiliateOrganizationKey}
/>
