type GetPdfBlobArguments = {
  driverFullName: string;
  driverEmail: string;
  driverPhone: string;
  referencePeriodString: string;
  deactivationPeriodString: string;
  totalNumberOfTrips: string;
  averageDailyPayString: string;
  grossEstimatedLostPay: string;
  grossEstimatedLostPayWithInterest: string;
  annualInterestRateAsString: string;
  deactivationPeriodDurationString: string;
  selectedEmployer: string | null;
};

const getPdfBlob = async ({
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
}: GetPdfBlobArguments) => {
  const res = await fetch('/organizer/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
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
    })
  });

  // replace spaces with underscores and make lowercase
  const filename = `${driverFullName?.replace(/\s/g, '_').toLowerCase()}_deactivation_report.pdf`;

  return {
    filename: filename,
    blob: await res.blob()
  };
};

export default getPdfBlob;

export type { GetPdfBlobArguments };
export { getPdfBlob };
