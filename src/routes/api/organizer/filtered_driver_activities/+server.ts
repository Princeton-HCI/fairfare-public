import getDriverActivities from '@src/lib/components/organizer/getDriverActivities';
import type { RequestEvent } from './$types';
import { USDformatter } from '@src/lib/utils';
import { hasCapability } from '@src/lib/rbac';
// Driver rows are read with the service-role client: RLS does not scope
// platform roles (a researcher has no membership), so every read below is
// scoped to the organization explicitly, in the app.
import { supabase } from '@src/lib/server/db';
import { driverBelongsToOrganization } from '@src/routes/organizer/utils.server';

export type FilteredDriverActivity = {
  employer: string | null;
  status: string | null;
  timezone: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  duration: number | null;
  start_location_lat: string | null;
  start_location_lng: string | null;
  start_location_formatted_address: string | null;
  end_location_lat: string | null;
  end_location_lng: string | null;
  end_location_formatted_address: string | null;
  distance: number | null;
  circumstances_is_surge: string | null;
  income_total_charge: number | null;
  income_pay: number | null;
  income_total: number | null;
  income_bonus: number | null;
  income_tips: number | null;
  income_fees: number | null;
};

export type FilteredActivitiesResponse = {
  mostRecentOneHundredActivities: FilteredDriverActivity[];
  referencePeriod: string;
  deactivationPeriod: string;
  totalNumberOfTrips: string;
  averageDailyPayString: string;
  averageDailyPay: number;
  grossEstimatedLostPay: string;
  grossEstimatedLostPayWithInterest: string;
  annualInterestRate: string;
  periodOfDeactivation: string;
  interestPeriod: string;
  demandLetterDate: string | null;
};

// Helper function to calculate duration in days between two dates
// NOTE: this is inclusive of the start and end dates
function calculateDurationInDays(startDate: Date, endDate: Date): number {
  const millisecondsInADay = 1000 * 60 * 60 * 24;
  return Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsInADay) + 1;
}

// Helper function to format a date range with duration
function formatDateRangeWithDuration(startDate: Date, endDate: Date, duration: number): string {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  return `${startDateStr} – ${endDateStr} (${duration} days)`;
}

// Helper function to calculate average daily pay from activities
function calculateAverageDailyPay(
  activities: FilteredDriverActivity[],
  referencePeriodDuration: number
): number {
  const totalIncome = activities.reduce((sum, activity) => sum + (activity.income_total ?? 0), 0);
  return totalIncome / referencePeriodDuration;
}

// Helper function to calculate lost pay with interest
function calculateLostPayWithInterest(
  baseAmount: number,
  interestRate: number,
  durationInDays: number
): number {
  return baseAmount * (1 + (interestRate / 100) * (durationInDays / 365));
}

// Helper function to format currency with optional suffix
function formatCurrencyWithSuffix(amount: number, suffix?: string): string {
  return USDformatter.format(amount) + (suffix ? ` (${suffix})` : '');
}

export const GET = async (request: RequestEvent) => {
  const { url } = request;
  const { user, roles } = await request.locals.safeGetSession();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const organizationKey = url.searchParams.get('organizationKey');
  if (!organizationKey || !hasCapability(roles, 'org:view_driver_pii', organizationKey)) {
    return new Response('You do not have access to this organization', { status: 403 });
  }

  // Get the query parameters
  const startDateString = url.searchParams.get('activitiesFilterStartDate');
  const endDateString = url.searchParams.get('activitiesFilterEndDate');
  const driverUserId = url.searchParams.get('driverUserId');

  const selectedEmployer = url.searchParams.get('selectedEmployer');

  if (!startDateString || !endDateString || !driverUserId) {
    return new Response('Missing required query parameters', { status: 400 });
  }

  if (!(await driverBelongsToOrganization(supabase, driverUserId, organizationKey))) {
    return new Response('You do not have access to this driver', { status: 403 });
  }

  // Parse dates
  const startDate = new Date(startDateString);
  const endDate = new Date(endDateString);

  // TODO: upgrade to PGRest 12 and enable aggregate functions in Supabase,
  // then use an aggregate query to get the sum of income_total
  // let query = supabase
  // .from('argyle_driver_activities')
  // .select('income_total.sum()', { count: 'exact' });

  let activities: FilteredDriverActivity[] = [];

  try {
    activities = await getDriverActivities(
      supabase,
      driverUserId,
      startDateString,
      endDateString,
      selectedEmployer
    );
  } catch (error) {
    return new Response(JSON.stringify(error), { status: 500 });
  }

  // Calculate reference period
  const referencePeriodDuration = calculateDurationInDays(startDate, endDate);
  const referencePeriod = formatDateRangeWithDuration(startDate, endDate, referencePeriodDuration);

  // Parse and validate deactivation date
  const deactivatedDateParam = url.searchParams.get('deactivatedDate');
  let deactivationStart: Date;
  if (deactivatedDateParam) {
    deactivationStart = new Date(deactivatedDateParam);
  } else {
    // If no value is passed
    // Compute deactivation period: assume deactivation starts the day after activitiesFilterEndDate and is ongoing
    deactivationStart = endDate;
    deactivationStart.setDate(deactivationStart.getDate() + 1);
  }

  // Parse reactivation and demand letter dates
  const reactivatedDateParam = url.searchParams.get('reactivatedDate');
  const demandLetterDateParam = url.searchParams.get('demandLetterDate');
  const isOngoing = !reactivatedDateParam;

  // Determine the end date for interest calculations
  const interestEndDate = demandLetterDateParam
    ? new Date(demandLetterDateParam)
    : reactivatedDateParam
      ? new Date(reactivatedDateParam)
      : new Date();

  // Calculate durations
  const reactivatedDateOrToday = reactivatedDateParam ? new Date(reactivatedDateParam) : new Date();
  const deactivatedDuration = calculateDurationInDays(deactivationStart, reactivatedDateOrToday);
  const interestDuration = calculateDurationInDays(deactivationStart, interestEndDate);

  // Calculate financial metrics
  const totalNumberOfTrips = activities.length.toLocaleString();
  const averageDailyPay = calculateAverageDailyPay(activities, referencePeriodDuration);
  const grossEstimatedLostPayAmount = averageDailyPay * deactivatedDuration;

  // Format financial metrics with appropriate suffixes
  const grossEstimatedLostPay = formatCurrencyWithSuffix(
    grossEstimatedLostPayAmount,
    isOngoing ? 'to date' : undefined
  );

  // Calculate interest
  const annualInterestRateValue = url.searchParams.get('annualInterestRate')
    ? parseInt(url.searchParams.get('annualInterestRate')!)
    : 12;
  const grossEstimatedLostPayWithInterestAmount = calculateLostPayWithInterest(
    grossEstimatedLostPayAmount,
    annualInterestRateValue,
    interestDuration
  );
  const grossEstimatedLostPayWithInterest = formatCurrencyWithSuffix(
    grossEstimatedLostPayWithInterestAmount,
    demandLetterDateParam || reactivatedDateParam ? undefined : 'to date'
  );

  // Format periods and rates
  const annualInterestRate = `${annualInterestRateValue}%`;
  const deactivationPeriod = isOngoing
    ? `${deactivationStart.toISOString().split('T')[0]} – present`
    : `${deactivationStart.toISOString().split('T')[0]} – ${reactivatedDateOrToday.toISOString().split('T')[0]} (${deactivatedDuration} days)`;
  const periodOfDeactivation = isOngoing
    ? `(${deactivatedDuration} days, to date)`
    : `(${deactivatedDuration} days)`;

  // Format interest calculation period
  const interestPeriod = formatDateRangeWithDuration(
    deactivationStart,
    interestEndDate,
    interestDuration
  );

  const response: FilteredActivitiesResponse = {
    mostRecentOneHundredActivities: activities.slice(0, 100),
    referencePeriod,
    deactivationPeriod,
    totalNumberOfTrips,
    averageDailyPay,
    averageDailyPayString: USDformatter.format(averageDailyPay),
    grossEstimatedLostPay,
    grossEstimatedLostPayWithInterest,
    annualInterestRate,
    periodOfDeactivation,
    interestPeriod,
    demandLetterDate: demandLetterDateParam || null
  };

  return new Response(JSON.stringify(response), { status: 200 });
};
