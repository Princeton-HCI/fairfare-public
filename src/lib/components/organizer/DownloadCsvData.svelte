<script lang="ts">
  import { StreamParser } from '@json2csv/plainjs';
  import { USDformatter } from '@src/lib/utils';
  import JSZip from 'jszip';
  import FileSaver from 'file-saver';
  import getPdfBlob from './getPdfBlob';

  import type { GetPdfBlobArguments } from './getPdfBlob';
  import {
    calculateGrossEstimatedLostPay,
    calculateGrossEstimatedLostPayWithInterest
  } from './calculateGrossEstimatesLostPay';

  type DriverActivityWithDriverName = SupabaseRows['argyle_driver_activities'] & {
    driver_name: string;
  };

  interface FormattedActivity {
    'Driver Name': string;
    Employer: string | null;
    'Start Date': string | null;
    'End Date': string | null;
    'Start Location Latitude': string | null;
    'Start Location Longitude': string | null;
    'End Location Latitude': string | null;
    'End Location Longitude': string | null;
    'Income Pay': string | 0 | null;
    'Income Total': string | 0 | null;
    'Income Bonus': string | 0 | null;
    'Income Tips': string | 0 | null;
    'Income Fees': string | 0 | null;
    'Average Daily Earnings'?: string;
  }

  interface Props {
    data: DriverActivityWithDriverName;
    driverName: string;
    averageDailyPay: number;
    deactivationPeriodDuration: number;
    annualInterestRate: number;
    getPdfBlobArguments: GetPdfBlobArguments;
  }

  let {
    data,
    driverName,
    averageDailyPay,
    deactivationPeriodDuration,
    annualInterestRate,
    getPdfBlobArguments
  }: Props = $props();

  const csvDownloadName = `${driverName.replace(/[^a-zA-Z]+/g, '_').toLowerCase()}_ride_data.csv`;
  const zipDownloadName = `${driverName.replace(/[^a-zA-Z]+/g, '_').toLowerCase()}_ride_data.zip`;

  const fields = [
    'Driver Name',
    'Employer',
    'Start Date',
    'End Date',
    'Start Location Latitude',
    'Start Location Longitude',
    'End Location Latitude',
    'End Location Longitude',
    'Income Pay',
    'Income Total',
    'Income Bonus',
    'Income Tips',
    'Income Fees'
  ];

  if (averageDailyPay) {
    fields.push('Average Daily Earnings');
  }

  const createCsv = (onEnd: (csv: string) => void) => {
    const dataAsPojo = JSON.parse(JSON.stringify(data));

    let csv = '';
    const opts = { fields: fields };
    const asyncOpts = {};
    const baseParser = new StreamParser(opts, asyncOpts);
    baseParser.onData = (chunk) => (csv += chunk.toString());
    baseParser.onError = (err) => console.error(err);
    baseParser.onEnd = () => onEnd(csv);

    dataAsPojo.forEach((activity: DriverActivityWithDriverName) => {
      const formattedActivity: FormattedActivity = {
        'Driver Name': driverName,
        Employer: activity.employer,
        'Start Date': activity.start_datetime,
        'End Date': activity.end_datetime,
        'Start Location Latitude': activity.start_location_lat,
        'Start Location Longitude': activity.start_location_lng,
        'End Location Latitude': activity.end_location_lat,
        'End Location Longitude': activity.end_location_lng,
        'Income Pay': activity.income_pay && USDformatter.format(activity.income_pay),
        'Income Total': activity.income_total && USDformatter.format(activity.income_total),
        'Income Bonus': activity.income_bonus && USDformatter.format(activity.income_bonus),
        'Income Tips': activity.income_tips && USDformatter.format(activity.income_tips),
        'Income Fees': activity.income_fees && USDformatter.format(activity.income_fees)
      };

      baseParser.pushLine(formattedActivity);
    });

    // Here we make the footer data to summarize the data
    baseParser.pushLine({ 'Income Total': '' }); // push an empty row
    // We want values in the Income Total and Income Bonus columns

    // Sum the Income Total for all the dataAsPojo values
    const incomeTotal = dataAsPojo.reduce(
      (accumulator: number, currentValue: DriverActivityWithDriverName) =>
        accumulator + (currentValue.income_total || 0),
      0
    );
    baseParser.pushLine({
      'Income Total': USDformatter.format(incomeTotal),
      'Income Bonus': 'Total pay'
    });

    baseParser.pushLine({
      'Income Total': USDformatter.format(averageDailyPay),
      'Income Bonus': 'Average daily pay'
    });

    const grossEstimatedLostPay = calculateGrossEstimatedLostPay(
      averageDailyPay,
      deactivationPeriodDuration
    );
    baseParser.pushLine({
      'Income Total': USDformatter.format(grossEstimatedLostPay),
      'Income Bonus': 'Gross estimated lost pay'
    });

    const grossEstimatedLostPayWithInterest = calculateGrossEstimatedLostPayWithInterest(
      averageDailyPay,
      deactivationPeriodDuration,
      annualInterestRate
    );
    baseParser.pushLine({
      'Income Total': USDformatter.format(grossEstimatedLostPayWithInterest),
      'Income Bonus': 'Gross estimated lost pay with interest'
    });
    baseParser.end();
  };

  const downloadCsv = async () => {
    const onDownloadEnd = (csv: string) => {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = csvDownloadName;
      link.click();

      // For Firefox it is necessary to delay revoking the ObjectURL.
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 250);
    };
    createCsv(onDownloadEnd);
  };

  const downloadZip = async () => {
    const zip = new JSZip();

    const onCsvDownloadEnd = async (csv: string) => {
      // get pdf blob
      const pdfBlob = await getPdfBlob(getPdfBlobArguments);
      zip.file(csvDownloadName, csv);
      zip.file(pdfBlob.filename, pdfBlob.blob);
      zip.generateAsync({ type: 'blob' }).then(function (content) {
        FileSaver.saveAs(content, zipDownloadName);
      });
    };
    createCsv(onCsvDownloadEnd);
  };
</script>

<div class="flex justify-end">
  <!-- TODO: disable the ZIP button like the other printing/downloading buttons -->
  <button onclick={downloadZip} class="btn mr-2">Download ZIP</button>
  <button onclick={downloadCsv} class="btn">Download CSV</button>
</div>
