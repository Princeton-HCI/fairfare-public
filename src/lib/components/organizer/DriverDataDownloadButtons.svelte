<script lang="ts">
  import { page } from '$app/state';
  import { hasCapability } from '@src/lib/rbac';
  import type { MakeDriverReportPdfBlobArguments } from '@src/routes/organizer/driver_report_pdf/makeDriverReportPdfBlob';

  interface Props {
    driverName: string;
    averageDailyPay: number;
    deactivationPeriodDuration: number;
    annualInterestRate: number;
    getPdfBlobArguments: MakeDriverReportPdfBlobArguments;
    driverUserId: string;
    startDateString?: string;
    endDateString?: string;
    selectedEmployer: string;
    affiliateOrganizationKey: string;
  }

  let {
    driverName,
    averageDailyPay,
    deactivationPeriodDuration,
    annualInterestRate,
    getPdfBlobArguments,
    driverUserId,
    startDateString,
    endDateString,
    selectedEmployer,
    affiliateOrganizationKey
  }: Props = $props();

  let isLoading = $state(false);

  // Researchers can view driver data but never download it; the server enforces
  // the same capability on /api/organizer/download_driver_data_zip.
  const canExport = $derived(
    hasCapability(page.data.roles, 'org:export_driver_data', affiliateOrganizationKey)
  );

  const fetchAndDownloadData = (includesPdf: boolean) => {
    if (isLoading) return;

    isLoading = true;
    const zipDownloadName = includesPdf
      ? `${driverName.replace(/[^a-zA-Z]+/g, '_').toLowerCase()}_ride_data_and_report.zip`
      : `${driverName.replace(/[^a-zA-Z]+/g, '_').toLowerCase()}_ride_data.zip`;

    fetch('/api/organizer/download_driver_data_zip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        driverUserId,
        startDateString,
        endDateString,
        selectedEmployer,
        driverName,
        averageDailyPay,
        deactivationPeriodDuration,
        annualInterestRate,
        includesPdf,
        pdfData: includesPdf ? getPdfBlobArguments : undefined,
        affiliateOrganizationKey
      })
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to download activities');
          return;
        }
        return response.blob();
      })
      .then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = zipDownloadName;
        link.click();

        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 250);
      })
      .finally(() => {
        isLoading = false;
      });
  };
</script>

{#if canExport}
  <div class="flex items-center gap-3 py-3">
    <button
      onclick={() => fetchAndDownloadData(true)}
      class="btn btn-sm btn-primary gap-1.5"
      disabled={isLoading}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
      {#if isLoading}
        Downloading...
      {:else}
        Download ZIP
      {/if}
    </button>
    <button
      onclick={() => fetchAndDownloadData(false)}
      class="btn btn-sm btn-ghost gap-1.5"
      disabled={isLoading}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
      {#if isLoading}
        Downloading...
      {:else}
        Download CSV
      {/if}
    </button>
  </div>
{/if}
