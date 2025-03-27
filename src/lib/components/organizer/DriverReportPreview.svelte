<script lang="ts">
  import { toast } from '@src/lib/toasts';
  import { onMount } from 'svelte'; // we need to load print-js dynamically, loading it on the server breaks // https://github.com/crabbly/Print.js/issues/400

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  let printJS: any;
  onMount(async () => {
    const p = await import('print-js');
    printJS = p.default;
  });

  import DriverNamePhoneAndEmail from '@src/lib/components/organizer/DriverNamePhoneAndEmail.svelte';
  import getPdfBlob from './getPdfBlob';

  import type { GetPdfBlobArguments } from './getPdfBlob';

  interface Props {
    annualInterestRateAsString: string;
    selectedEmployer: string | null;
    referencePeriodString: string;
    deactivationPeriodString: string;
    totalNumberOfTrips: string;
    grossEstimatedLostPay: string;
    grossEstimatedLostPayWithInterest: string;
    deactivationPeriodDurationString: string;
    driverFullName: string;
    driverEmail: string;
    driverPhone: string;
    getPdfBlobArguments?: GetPdfBlobArguments;
    averageDailyPayString: string;
    missingInputData: boolean;
  }

  let {
    annualInterestRateAsString,
    selectedEmployer,
    referencePeriodString,
    deactivationPeriodString,
    totalNumberOfTrips,
    grossEstimatedLostPay,
    grossEstimatedLostPayWithInterest,
    deactivationPeriodDurationString,
    driverFullName,
    driverEmail,
    driverPhone,
    getPdfBlobArguments,
    averageDailyPayString,
    missingInputData
  }: Props = $props();

  let isPrinting = $state(false);
  let isDownloading = $state(false);

  const downloadPdf = async (shouldPrint: boolean) => {
    if (getPdfBlobArguments === undefined) {
      console.error('Missing getPdfBlobArguments');
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

    const { filename, blob } = await getPdfBlob(getPdfBlobArguments); // MS Edge and IE don't allow using a blob object directly as link href, instead it is necessary to use msSaveOrOpenBlob // @ts-expect-error Property 'msSaveOrOpenBlob' does not exist on type 'Navigator'.ts(2339)

    // @ts-expect-error Property 'msSaveOrOpenBlob' does not exist on type 'Navigator'.ts(2339)
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      // @ts-expect-error Property 'msSaveOrOpenBlob' does not exist on type 'Navigator'.ts(2339)
      window.navigator.msSaveOrOpenBlob(blob, filename);
    } else {
      // For other browsers: create a link pointing to the ObjectURL containing the blob.
      const objUrl = window.URL.createObjectURL(blob);
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
        const data = window.URL.createObjectURL(blob);

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

        isDownloading = false;
      }
    }
  };

  let printButtonDisabled = $derived(isPrinting || missingInputData);

  let downloadButtonDisabled = $derived(isDownloading || missingInputData);
</script>

<div class="max-w-lg mx-auto">
  <div class="flex flex-row items-center gap-2 justify-between">
    <h2 class="font-bold text-lg">Report Preview</h2>
    <div class="flex flex-row gap-2">
      <button class="btn self-end" disabled={printButtonDisabled} onclick={() => downloadPdf(true)}>
        {isPrinting ? 'Printing...' : 'Print'}
      </button>
      <button
        class="btn self-end"
        disabled={downloadButtonDisabled}
        onclick={() => downloadPdf(false)}
      >
        {isDownloading ? 'Downloading...' : 'Download'}
      </button>
    </div>
  </div>
  <div class="my-2 p-4 rounded-sm border bg-white">
    {#if missingInputData}
      <div class="h-64 flex items-center justify-center">
        <p class="text-error">Please complete the above fields to generate the report</p>
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
        <b class="font-bold">{referencePeriodString}</b>
      </p>
      <p>
        Deactivation period:
        <b class="font-bold">{deactivationPeriodString}</b>
      </p>
      <p>
        Total number of trips: <b class="font-bold">{totalNumberOfTrips.toLocaleString()}</b>
      </p>
      <br />
      <p>Average daily pay: <b class="font-bold">{averageDailyPayString}</b></p>

      {#if grossEstimatedLostPay != '$NaN'}
        <p>
          Gross estimated lost pay: <b class="font-bold">{grossEstimatedLostPay}</b>
        </p>
        <p>
          Gross estimated lost pay with interest: <b class="font-bold">
            {grossEstimatedLostPayWithInterest}
          </b>
        </p>
      {/if}
      <p>
        Annual interest rate: <b class="font-bold">{annualInterestRateAsString}</b>
      </p>
      <br />

      <p>
        Period of deactivation: <b class="font-bold">{deactivationPeriodDurationString}</b>
      </p>
      {#if selectedEmployer}
        <p>Platform: <b class="font-bold">{selectedEmployer}</b></p>
      {/if}
      <div class="h-20"></div>
    {/if}
  </div>
</div>
