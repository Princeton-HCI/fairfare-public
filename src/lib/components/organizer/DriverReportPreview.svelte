<script lang="ts">
  import { toast } from '@src/lib/toasts';
  import { page } from '$app/state';
  import { hasCapability } from '@src/lib/rbac';
  import { onMount } from 'svelte'; // we need to load print-js dynamically, loading it on the server breaks // https://github.com/crabbly/Print.js/issues/400

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  let printJS: any;
  onMount(async () => {
    const p = await import('print-js');
    printJS = p.default;
  });

  import DriverNamePhoneAndEmail from '@src/lib/components/organizer/DriverNamePhoneAndEmail.svelte';
  import makeDriverReportPdfBlob from '@src/routes/organizer/driver_report_pdf/makeDriverReportPdfBlob';
  import type { FilteredActivitiesResponse } from '@src/routes/api/organizer/filtered_driver_activities/+server';

  interface Props {
    backendData: FilteredActivitiesResponse | undefined;
    driverEmail: string;
    driverFullName: string;
    driverPhone: string;
    isLoading: boolean;
    missingInputData: boolean;
    selectedEmployer: string | null;
  }

  let {
    backendData,
    selectedEmployer,
    driverFullName,
    driverEmail,
    driverPhone,
    missingInputData,
    isLoading
  }: Props = $props();

  let isPrinting = $state(false);
  let isDownloading = $state(false);

  const downloadPdf = async (shouldPrint: boolean) => {
    if (!backendData) {
      console.error('Missing backend data');
      toast({ text: 'Failed to generate report', type: 'error' });
      return;
    }

    if (shouldPrint) {
      isPrinting = true;
    } else {
      isDownloading = true;
    }

    if (driverFullName === null || driverEmail === null || driverPhone === null) {
      console.error('Missing driver information');
      return;
    }

    try {
      const pdfBlob = await makeDriverReportPdfBlob(
        driverFullName,
        driverEmail,
        driverPhone,
        backendData.referencePeriod,
        backendData.deactivationPeriod,
        backendData.totalNumberOfTrips,
        backendData.averageDailyPayString,
        backendData.grossEstimatedLostPay,
        backendData.grossEstimatedLostPayWithInterest,
        backendData.annualInterestRate,
        selectedEmployer ?? undefined,
        backendData.interestPeriod,
        backendData.demandLetterDate
      );

      const filename = `${driverFullName.replace(/[^a-zA-Z]+/g, '_').toLowerCase()}_earnings_report.pdf`;

      // @ts-expect-error Property 'msSaveOrOpenBlob' does not exist on type 'Navigator'.ts(2339)
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        // @ts-expect-error Property 'msSaveOrOpenBlob' does not exist on type 'Navigator'.ts(2339)
        window.navigator.msSaveOrOpenBlob(pdfBlob, filename);
      } else {
        // For other browsers: create a link pointing to the ObjectURL containing the blob.
        const objUrl = window.URL.createObjectURL(pdfBlob);
        console.log(objUrl);

        if (shouldPrint) {
          // Create a new window for the PDF
          const printWindow = window.open(objUrl, '_blank'); // Wait for the PDF to load

          // TODO: update the download filename for printing
          if (printWindow) {
            printWindow.onload = function () {
              // Trigger the print dialog
              printWindow.print(); // Clean up: revoke the blob URL after a delay

              setTimeout(() => {
                window.URL.revokeObjectURL(objUrl);
                isPrinting = false;
              }, 1000);
            };
          } else {
            console.error('Failed to open print window. Pop-ups might be blocked.');
            isPrinting = false;
          }
        } else {
          // Create a link pointing to the ObjectURL containing the blob.
          const data = window.URL.createObjectURL(pdfBlob);

          const link = document.createElement('a');
          link.href = data;
          link.download = filename;

          // this is necessary as link.click() does not work on the latest firefox
          link.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            })
          );

          setTimeout(() => {
            // For Firefox it is necessary to delay revoking the ObjectURL
            window.URL.revokeObjectURL(data);
            link.remove();
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ text: 'Failed to generate report', type: 'error' });
    } finally {
      isDownloading = false;
    }
  };

  let printButtonDisabled = $derived(isPrinting || missingInputData);

  let downloadButtonDisabled = $derived(isDownloading || missingInputData);

  // The PDF is rendered in the browser, so this can only hide the controls;
  // the server-side ZIP/PDF endpoints enforce the same capability.
  const canExport = $derived(
    hasCapability(page.data.roles, 'org:export_driver_data', page.params.affiliate_organization_key)
  );
</script>

<div>
  <div class="flex flex-row items-center gap-2 justify-between">
    <h2 class="font-semibold text-base text-base-content">Report Preview</h2>
    {#if canExport}
      <div class="flex flex-row gap-2">
        <button
          class="btn btn-sm btn-ghost gap-1.5"
          disabled={printButtonDisabled}
          onclick={() => downloadPdf(true)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            /></svg
          >
          {isPrinting ? 'Printing...' : 'Print'}
        </button>
        <button
          class="btn btn-sm btn-primary gap-1.5"
          disabled={downloadButtonDisabled}
          onclick={() => downloadPdf(false)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            ><path
              fill-rule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clip-rule="evenodd"
            /></svg
          >
          {isDownloading ? 'Downloading...' : 'Download'}
        </button>
      </div>
    {/if}
  </div>
  <div class="my-2 p-5 rounded-lg bg-white shadow-sm">
    {#if missingInputData}
      <div class="h-64 flex items-center justify-center">
        <p class="text-error">Please complete the above fields to generate the report</p>
      </div>
    {:else if isLoading || backendData === undefined}
      <div class="h-64 flex items-center justify-center">
        <p>Loading activities...</p>
      </div>
    {:else}
      <!-- 
        We want the hasSynced value to be false because
        this is inside the report preview and the fully synced text
        does not appear in the actual report.
      -->
      <DriverNamePhoneAndEmail
        fullName={driverFullName}
        email={driverEmail}
        phone={driverPhone}
        hasSynced={false}
      />

      <div class="h-1"></div>
      <p>
        Reference period:
        <b class="font-bold">{backendData.referencePeriod}</b>
      </p>
      <p>
        Deactivation period:
        <b class="font-bold">{backendData.deactivationPeriod}</b>
      </p>
      <br />
      <p>Average daily pay: <b class="font-bold">{backendData.averageDailyPayString}</b></p>

      <p>
        Gross estimated lost pay: <b class="font-bold">{backendData.grossEstimatedLostPay}</b>
      </p>
      <br />
      <p>
        Gross estimated lost pay with interest: <b class="font-bold">
          {backendData.grossEstimatedLostPayWithInterest}
        </b>
      </p>
      <p>
        Annual interest rate: <b class="font-bold">{backendData.annualInterestRate}</b>
      </p>
      <p>
        Interest calculation period: <b class="font-bold">{backendData.interestPeriod}</b>
      </p>
      {#if backendData.demandLetterDate}
        <p>
          Demand/arbitration date: <b class="font-bold">{backendData.demandLetterDate}</b>
        </p>
      {/if}
      {#if selectedEmployer}
        <br />
        <p>Platform: <b class="font-bold">{selectedEmployer}</b></p>
      {/if}
    {/if}
  </div>
</div>
