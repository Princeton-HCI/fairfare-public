import type { RequestEvent } from './$types';
import { hasCapability } from '@src/lib/rbac';
import makeDriverReportPdfBlob from './makeDriverReportPdfBlob';

export const POST = async (event: RequestEvent) => {
  // Here we check to see if this is a user; they don't really need to be
  // authenticated but it prevents anonymous users from accessing this route.

  const { safeGetSession } = event.locals;
  const { user, roles } = await safeGetSession();

  if (!user) {
    return new Response('No user found', { status: 404 });
  }

  const {
    affiliateOrganizationKey,
    driverFullName,
    driverEmail,
    driverPhone,
    referencePeriodString,
    deactivationPeriodString,
    activitiesCountString,
    averageDailyPayString,
    grossEstimatedLostPay,
    grossEstimatedLostPayWithInterest,
    annualInterestRateAsString,
    selectedEmployer,
    interestPeriod,
    demandLetterDate
  } = await event.request.json();

  if (typeof affiliateOrganizationKey !== 'string' || !affiliateOrganizationKey) {
    return new Response('affiliateOrganizationKey is required', { status: 400 });
  }

  if (!hasCapability(roles, 'org:export_driver_data', affiliateOrganizationKey)) {
    return new Response('You do not have access to this organization', { status: 403 });
  }

  const pdfBlob = await makeDriverReportPdfBlob(
    driverFullName,
    driverEmail,
    driverPhone,
    referencePeriodString,
    deactivationPeriodString,
    activitiesCountString,
    averageDailyPayString,
    grossEstimatedLostPay,
    grossEstimatedLostPayWithInterest,
    annualInterestRateAsString,
    selectedEmployer,
    interestPeriod,
    demandLetterDate
  );

  const responseHeaders = {
    'Content-Type': 'application/pdf'
  };
  return new Response(pdfBlob, { status: 200, headers: responseHeaders });
};

/*
Test with curl:

curl --location 'http://localhost:5173/organizer/driver_report_pdf' \
--header 'Content-Type: application/json' \
--data-raw '{
    "driverFullName": "Driver Name",
    "driverPhone": "(303) 333-3333",
    "driverEmail": "email@gmail.com",
    "referencePeriodString": "2024-05-01 – 2024-06-01",
    "deactivationPeriodString": "2024-04-12 – 2024-04-28",
    "activitiesCountString": "150",
    "averageDailyPayString": "$416.16",
    "grossEstimatedLostPay": "$6,658.56",
    "grossEstimatedLostPayWithInterest": "$6,725.15",
    "annualInterestRateAsString": "5%",
    "deactivationPeriodDurationString": "16 days",
    "selectedEmployer": "Uber"
}'
*/
