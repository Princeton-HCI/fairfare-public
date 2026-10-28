import moment from 'moment';
import type { SupabaseClient } from '@supabase/supabase-js';

type ArgyleDriverActivity = SupabaseRows['argyle_driver_activities'];

// Ridge Regression Model Constants
const MODEL_COEFFICIENT = 0.71;
const MODEL_INTERCEPT = 8.83;

/** Minimum combined before+after hours to show missed-opportunities estimate; below this we show "insufficient baseline data". */
export const MIN_HOURS_FOR_RELIABLE_RATE = 20;

/**
 * Predict actual online hours using Ridge Regression model
 * Formula: Predicted Hours = 0.71 × Screenshot Hours + 8.83
 * This is the core of the estimation - takes user-reported hours and estimates actual hours
 */
export function predictActualHours(screenshotHours: number): number {
  if (screenshotHours <= 0) return 0;
  return MODEL_COEFFICIENT * screenshotHours + MODEL_INTERCEPT;
}

/**
 * Estimates what screenshot-reported hours would show, given actual hours
 * Formula: Screenshot Hours = (Actual Hours - 8.83) / 0.71
 * This is used to convert baseline actual hours to estimated screenshot hours,
 * then we apply the model forward to get refined estimated actual hours
 */
export function estimateScreenshotHours(actualHours: number): number {
  if (actualHours <= MODEL_INTERCEPT) return 0;
  return (actualHours - MODEL_INTERCEPT) / MODEL_COEFFICIENT;
}

/**
 * Calculate online hours from activity duration and shift times
 * Uses actual hours from Argyle (for before/after periods)
 */
export function calculateOnlineHours(activity: ArgyleDriverActivity): number {
  let hours = 0;
  // If we have shift start/end times, use those for more accurate online time
  // Otherwise, use duration (in seconds, convert to hours)
  if (activity.start_datetime && activity.end_datetime) {
    const start = moment(activity.start_datetime);
    const end = moment(activity.end_datetime);
    hours = end.diff(start, 'hours', true); // true for floating point
  } else if (activity.duration) {
    // Fallback to duration if available (assumes duration is in seconds)
    hours = activity.duration / 3600;
  }
  // Clamp to non-negative so bad data (e.g. end before start) doesn't break metrics
  return Math.max(0, hours);
}

/**
 * Calculate earnings from an activity
 */
export function calculateEarnings(activity: ArgyleDriverActivity): number {
  // Use income_total (net earnings after platform fees); coerce to number for safety
  const raw = activity.income_total;
  if (raw == null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Group activities by week (Monday-based weeks)
 */
export function groupActivitiesByWeek(
  activities: ArgyleDriverActivity[]
): Map<string, ArgyleDriverActivity[]> {
  const weekGroups = new Map<string, ArgyleDriverActivity[]>();

  for (const activity of activities) {
    if (!activity.start_datetime) continue;

    const date = moment(activity.start_datetime);
    // Get Monday of the week
    const weekStart = date.clone().startOf('isoWeek'); // isoWeek starts on Monday
    const weekKey = weekStart.format('YYYY-MM-DD');

    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(activity);
  }

  return weekGroups;
}

export interface WeeklyMetrics {
  weekStart: string;
  weekEnd: string;
  totalOnlineHours: number;
  totalEarnings: number;
  totalTrips: number;
  avgHourlyPay: number;
}

/**
 * Calculate weekly metrics from activities
 * Uses actual Argyle hours (no Ridge Regression needed for periods with tracking data)
 */
export function calculateWeeklyMetrics(
  weekStart: moment.Moment,
  activities: ArgyleDriverActivity[]
): WeeklyMetrics {
  let totalOnlineHours = 0;
  let totalEarnings = 0;
  let totalTrips = 0;

  for (const activity of activities) {
    const hours = calculateOnlineHours(activity);
    const earnings = calculateEarnings(activity);

    totalOnlineHours += hours;
    totalEarnings += earnings;

    // Count completed trips (assuming status === 'completed' or type === 'rideshare')
    if (activity.status === 'completed' || activity.type === 'rideshare') {
      totalTrips += 1;
    }
  }

  const weekEnd = weekStart.clone().endOf('isoWeek');
  const avgHourlyPay = totalOnlineHours > 0 ? totalEarnings / totalOnlineHours : 0;

  return {
    weekStart: weekStart.format('YYYY-MM-DD'),
    weekEnd: weekEnd.format('YYYY-MM-DD'),
    totalOnlineHours,
    totalEarnings,
    totalTrips,
    avgHourlyPay
  };
}

/**
 * Calculate weekly metrics from REPORTED hours using Ridge Regression
 * This is used for deactivation periods where we have user-reported hours
 */
export function calculateWeeklyMetricsFromReportedHours(
  weekStart: moment.Moment,
  reportedHours: number,
  earnings: number,
  trips: number
): WeeklyMetrics {
  // Apply Ridge Regression model to estimate actual hours from reported hours
  const estimatedActualHours = predictActualHours(reportedHours);

  const weekEnd = weekStart.clone().endOf('isoWeek');
  const avgHourlyPay = estimatedActualHours > 0 ? earnings / estimatedActualHours : 0;

  return {
    weekStart: weekStart.format('YYYY-MM-DD'),
    weekEnd: weekEnd.format('YYYY-MM-DD'),
    totalOnlineHours: estimatedActualHours,
    totalEarnings: earnings,
    totalTrips: trips,
    avgHourlyPay
  };
}

export interface PeriodMetrics {
  startDate: string;
  endDate: string;
  workingDays: number;
  weeks: number;
  totalTrips: number;
  totalEarnings: number;
  avgDailyOnlineHours: number;
  avgDailyHourlyPay: number;
  totalOnlineHours: number;
  avgHourlyPay: number;
  weeklyData: WeeklyMetrics[];
}

/**
 * Calculate metrics for a specific time period using actual Argyle activities
 * (Used for before/after periods where we have tracking data)
 */
export function calculatePeriodMetrics(
  activities: ArgyleDriverActivity[],
  startDate: Date,
  endDate: Date
): PeriodMetrics {
  // Filter activities within date range
  const filteredActivities = activities.filter((activity) => {
    if (!activity.start_datetime) return false;
    const activityDate = moment(activity.start_datetime);
    return (
      activityDate.isSameOrAfter(moment(startDate).startOf('day')) &&
      activityDate.isSameOrBefore(moment(endDate).endOf('day'))
    );
  });

  // Group by week
  const weekGroups = groupActivitiesByWeek(filteredActivities);

  // Calculate weekly metrics
  const weeklyData: WeeklyMetrics[] = [];
  for (const [weekKey, weekActivities] of weekGroups.entries()) {
    const weekStart = moment(weekKey);
    const metrics = calculateWeeklyMetrics(weekStart, weekActivities);
    weeklyData.push(metrics);
  }

  // Sort by week start
  weeklyData.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Calculate totals
  let totalOnlineHours = 0;
  let totalEarnings = 0;
  let totalTrips = 0;
  const dailyRates: number[] = [];

  for (const week of weeklyData) {
    totalOnlineHours += week.totalOnlineHours;
    totalEarnings += week.totalEarnings;
    totalTrips += week.totalTrips;

    // Calculate daily rate for this week
    const weekDays = moment(week.weekEnd).diff(moment(week.weekStart), 'days') + 1;
    if (weekDays > 0 && week.totalOnlineHours > 0) {
      const dailyHours = week.totalOnlineHours / weekDays;
      const dailyEarnings = week.totalEarnings / weekDays;
      if (dailyHours > 0) {
        dailyRates.push(dailyEarnings / dailyHours);
      }
    }
  }

  // Calculate working days (total days in period)
  const workingDays = moment(endDate).diff(moment(startDate), 'days') + 1;
  // Use calendar weeks for the period span (consistent with other period metrics)
  const weeks = workingDays > 0 ? Math.max(1, Math.round(workingDays / 7)) : 0;

  const avgDailyOnlineHours = workingDays > 0 ? totalOnlineHours / workingDays : 0;
  const avgDailyHourlyPay =
    dailyRates.length > 0
      ? dailyRates.reduce((a: number, b: number) => a + b, 0) / dailyRates.length
      : 0;
  const avgHourlyPay = totalOnlineHours > 0 ? totalEarnings / totalOnlineHours : 0;

  return {
    startDate: moment(startDate).format('YYYY-MM-DD'),
    endDate: moment(endDate).format('YYYY-MM-DD'),
    workingDays,
    weeks,
    totalTrips,
    totalEarnings,
    avgDailyOnlineHours,
    avgDailyHourlyPay,
    totalOnlineHours,
    avgHourlyPay,
    weeklyData
  };
}

/**
 * Calculate period metrics from screenshot-reported hours using Ridge Regression
 * This is used for deactivation periods where users provide screenshot-reported hours
 * The model converts reported hours to estimated actual hours: predicted = 0.71 × reported + 8.83
 */
export interface ReportedWeekData {
  weekStart: string; // YYYY-MM-DD format
  reportedHours: number;
  earnings: number;
  trips: number;
}

export function calculatePeriodMetricsFromReportedHours(
  reportedWeeks: ReportedWeekData[],
  startDate: Date,
  endDate: Date
): PeriodMetrics {
  // Calculate weekly metrics from reported hours, applying Ridge Regression model
  const weeklyData: WeeklyMetrics[] = [];

  for (const reportedWeek of reportedWeeks) {
    const weekStart = moment(reportedWeek.weekStart);
    const metrics = calculateWeeklyMetricsFromReportedHours(
      weekStart,
      reportedWeek.reportedHours,
      reportedWeek.earnings,
      reportedWeek.trips
    );
    weeklyData.push(metrics);
  }

  // Sort by week start
  weeklyData.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Calculate totals
  let totalOnlineHours = 0;
  let totalEarnings = 0;
  let totalTrips = 0;
  const dailyRates: number[] = [];

  for (const week of weeklyData) {
    totalOnlineHours += week.totalOnlineHours;
    totalEarnings += week.totalEarnings;
    totalTrips += week.totalTrips;

    // Calculate daily rate for this week
    const weekDays = moment(week.weekEnd).diff(moment(week.weekStart), 'days') + 1;
    if (weekDays > 0 && week.totalOnlineHours > 0) {
      const dailyHours = week.totalOnlineHours / weekDays;
      const dailyEarnings = week.totalEarnings / weekDays;
      if (dailyHours > 0) {
        dailyRates.push(dailyEarnings / dailyHours);
      }
    }
  }

  // Calculate working days (total days in period)
  const workingDays = moment(endDate).diff(moment(startDate), 'days') + 1;
  // Use calendar weeks for the period span, not count of reported weeks
  const weeks = workingDays > 0 ? Math.max(1, Math.round(workingDays / 7)) : 0;

  const avgDailyOnlineHours = workingDays > 0 ? totalOnlineHours / workingDays : 0;
  const avgDailyHourlyPay =
    dailyRates.length > 0
      ? dailyRates.reduce((a: number, b: number) => a + b, 0) / dailyRates.length
      : 0;
  const avgHourlyPay = totalOnlineHours > 0 ? totalEarnings / totalOnlineHours : 0;

  return {
    startDate: moment(startDate).format('YYYY-MM-DD'),
    endDate: moment(endDate).format('YYYY-MM-DD'),
    workingDays,
    weeks,
    totalTrips,
    totalEarnings,
    avgDailyOnlineHours,
    avgDailyHourlyPay,
    totalOnlineHours,
    avgHourlyPay,
    weeklyData
  };
}

/**
 * Estimate deactivation period metrics from before/after baseline using Ridge Regression model
 * Since driver didn't drive during deactivation (0 hours), we estimate what they WOULD HAVE worked
 *
 * Approach:
 * 1. Use before/after actual hours to establish baseline
 * 2. Estimate what "screenshot-reported hours" they would have shown (inverse model)
 * 3. Apply Ridge Regression model to convert estimated screenshot hours → estimated actual hours
 *
 * This accounts for the discrepancy between screenshot-reported and actual hours
 */
export function estimateDeactivationPeriodFromBaseline(
  beforeMetrics: PeriodMetrics,
  afterMetrics: PeriodMetrics,
  deactivationStart: Date,
  deactivationEnd: Date
): PeriodMetrics {
  // Use before period as baseline (or after if before has no data)
  let baselineDailyActualHours = 0;
  let baselineHourlyPay = 0;

  if (beforeMetrics.avgDailyOnlineHours > 0) {
    baselineDailyActualHours = beforeMetrics.avgDailyOnlineHours;
    baselineHourlyPay = beforeMetrics.avgHourlyPay;
  } else if (afterMetrics.avgDailyOnlineHours > 0) {
    baselineDailyActualHours = afterMetrics.avgDailyOnlineHours;
    baselineHourlyPay = afterMetrics.avgHourlyPay;
  }

  // Calculate working days in deactivation period
  const workingDays = moment(deactivationEnd).diff(moment(deactivationStart), 'days') + 1;

  // Step 1: Estimate what screenshot-reported hours would have shown (based on baseline actual hours)
  // Convert baseline actual hours to estimated screenshot hours using inverse model
  const baselineScreenshotHoursPerDay = estimateScreenshotHours(baselineDailyActualHours);
  const totalScreenshotHours = baselineScreenshotHoursPerDay * workingDays;

  // Step 2: Apply Ridge Regression model to estimate actual hours they would have worked
  // This refines the estimate by accounting for the screenshot vs actual hours discrepancy
  const totalOnlineHours = predictActualHours(totalScreenshotHours);

  // Calculate daily online hours from the refined estimate
  const avgDailyOnlineHours = workingDays > 0 ? totalOnlineHours / workingDays : 0;

  // Estimate total earnings using baseline hourly pay (unchanged)
  const totalEarnings = totalOnlineHours * baselineHourlyPay;

  // Estimate trips based on baseline pattern (trips per hour from before/after)
  const baselineTripsPerHour =
    beforeMetrics.totalOnlineHours > 0
      ? beforeMetrics.totalTrips / beforeMetrics.totalOnlineHours
      : afterMetrics.totalOnlineHours > 0
        ? afterMetrics.totalTrips / afterMetrics.totalOnlineHours
        : 0;
  const totalTrips = Math.round(totalOnlineHours * baselineTripsPerHour);

  // Create weekly breakdown for deactivation period
  // Group by weeks (Monday-based), matching the original code structure
  const weeklyData: WeeklyMetrics[] = [];
  const currentDate = moment(deactivationStart).startOf('isoWeek'); // Start from Monday of week

  while (currentDate.isSameOrBefore(moment(deactivationEnd))) {
    const weekStart = currentDate.clone();
    const weekEnd = currentDate.clone().endOf('isoWeek');

    // Clamp to deactivation period boundaries
    const periodWeekStart = moment.max(weekStart, moment(deactivationStart));
    const periodWeekEnd = moment.min(weekEnd, moment(deactivationEnd));

    const daysInWeek = periodWeekEnd.diff(periodWeekStart, 'days') + 1;

    // Apply Ridge Regression for each week
    const weekScreenshotHours = baselineScreenshotHoursPerDay * daysInWeek;
    const weekOnlineHours = predictActualHours(weekScreenshotHours);
    const weekEarnings = weekOnlineHours * baselineHourlyPay;
    const weekTrips = Math.round(weekOnlineHours * baselineTripsPerHour);

    weeklyData.push({
      weekStart: periodWeekStart.format('YYYY-MM-DD'),
      weekEnd: periodWeekEnd.format('YYYY-MM-DD'),
      totalOnlineHours: weekOnlineHours,
      totalEarnings: weekEarnings,
      totalTrips: weekTrips,
      avgHourlyPay: baselineHourlyPay
    });

    // Move to next week
    currentDate.add(1, 'week').startOf('isoWeek');
  }

  // Calculate daily rates (using refined estimates)
  const dailyRates: number[] = [];
  for (const week of weeklyData) {
    const weekDays = moment(week.weekEnd).diff(moment(week.weekStart), 'days') + 1;
    if (weekDays > 0 && week.totalOnlineHours > 0) {
      const dailyHours = week.totalOnlineHours / weekDays;
      const dailyEarnings = week.totalEarnings / weekDays;
      if (dailyHours > 0) {
        dailyRates.push(dailyEarnings / dailyHours);
      }
    }
  }

  // Use calendar weeks for the period span (consistent with other period metrics)
  const weeks = workingDays > 0 ? Math.max(1, Math.round(workingDays / 7)) : 0;
  const avgDailyHourlyPay =
    dailyRates.length > 0
      ? dailyRates.reduce((a: number, b: number) => a + b, 0) / dailyRates.length
      : baselineHourlyPay;
  // Calculate avgHourlyPay from actual estimated values, not just baseline
  // If totalOnlineHours is 0, avgHourlyPay should be 0 (not baseline)
  const avgHourlyPay = totalOnlineHours > 0 ? totalEarnings / totalOnlineHours : 0;

  return {
    startDate: moment(deactivationStart).format('YYYY-MM-DD'),
    endDate: moment(deactivationEnd).format('YYYY-MM-DD'),
    workingDays,
    weeks,
    totalTrips,
    totalEarnings,
    avgDailyOnlineHours,
    avgDailyHourlyPay,
    totalOnlineHours,
    avgHourlyPay,
    weeklyData
  };
}

export interface MissedOpportunities {
  missedHours: number;
  missedEarnings: number;
  baselineDailyHours: number;
  baselineHourlyPay: number;
}

/**
 * Calculate estimated missed opportunities during deactivation period
 * Compares what driver WOULD HAVE worked (baseline) vs what they ACTUALLY worked during deactivation
 *
 * For full deactivation (0 hours): missed = baseline expected
 * For partial deactivation (reduced hours): missed = baseline expected - actual
 */
export function calculateMissedOpportunities(
  beforeMetrics: PeriodMetrics,
  deactivationMetrics: PeriodMetrics,
  afterMetrics: PeriodMetrics
): MissedOpportunities {
  // Optimized for Argyle data (which can be sparse):
  // 1. Combine before + after periods for more stable calculations
  // 2. Use median of weekly rates when possible (robust to outliers)
  // 3. Require minimum data thresholds for reliability
  // 4. Fall back gracefully when data is insufficient

  let baselineDailyHours = 0;
  let baselineHourlyPay = 0;

  // Calculate baseline daily hours: prefer before, fallback to after
  if (beforeMetrics.avgDailyOnlineHours > 0) {
    baselineDailyHours = beforeMetrics.avgDailyOnlineHours;
  } else if (afterMetrics.avgDailyOnlineHours > 0) {
    baselineDailyHours = afterMetrics.avgDailyOnlineHours;
  }

  // Calculate baseline hourly pay using robust methods for Argyle data
  const combinedHours = beforeMetrics.totalOnlineHours + afterMetrics.totalOnlineHours;
  const combinedEarnings = beforeMetrics.totalEarnings + afterMetrics.totalEarnings;

  // Strategy 1: If we have sufficient combined data (>= 20 hours), use combined rate
  // This is the most stable approach with sparse Argyle data
  if (combinedHours >= 20 && combinedEarnings > 0) {
    baselineHourlyPay = combinedEarnings / combinedHours;
  }
  // Strategy 2: If combined data is insufficient, try median of weekly rates
  // Median is more robust to outliers than mean (important with sparse data)
  else if (beforeMetrics.weeklyData || afterMetrics.weeklyData) {
    const allWeeklyRates: number[] = [];

    // Collect weekly rates from both periods
    if (beforeMetrics.weeklyData) {
      beforeMetrics.weeklyData.forEach((week) => {
        if (week.totalOnlineHours > 0 && week.avgHourlyPay > 0) {
          allWeeklyRates.push(week.avgHourlyPay);
        }
      });
    }
    if (afterMetrics.weeklyData) {
      afterMetrics.weeklyData.forEach((week) => {
        if (week.totalOnlineHours > 0 && week.avgHourlyPay > 0) {
          allWeeklyRates.push(week.avgHourlyPay);
        }
      });
    }

    // Use median if we have at least 3 weeks of data
    if (allWeeklyRates.length >= 3) {
      allWeeklyRates.sort((a, b) => a - b);
      const medianIndex = Math.floor(allWeeklyRates.length / 2);
      const medianRate =
        allWeeklyRates.length % 2 === 0
          ? (allWeeklyRates[medianIndex - 1] + allWeeklyRates[medianIndex]) / 2
          : allWeeklyRates[medianIndex];

      // Filter out extreme outliers (more than 3x median) and recalculate
      const filteredRates = allWeeklyRates.filter(
        (rate) => rate <= medianRate * 3 && rate >= medianRate / 3
      );
      if (filteredRates.length >= 3) {
        filteredRates.sort((a, b) => a - b);
        const filteredMedianIndex = Math.floor(filteredRates.length / 2);
        baselineHourlyPay =
          filteredRates.length % 2 === 0
            ? (filteredRates[filteredMedianIndex - 1] + filteredRates[filteredMedianIndex]) / 2
            : filteredRates[filteredMedianIndex];
      } else {
        baselineHourlyPay = medianRate;
      }
    }
  }

  // Strategy 3: Fallback to combined rate even if < 20 hours (better than nothing)
  if (baselineHourlyPay === 0 && combinedHours > 0 && combinedEarnings > 0) {
    baselineHourlyPay = combinedEarnings / combinedHours;
  }

  // Strategy 4: Last resort - use individual period rates
  if (baselineHourlyPay === 0) {
    if (
      beforeMetrics.totalOnlineHours > afterMetrics.totalOnlineHours &&
      beforeMetrics.avgHourlyPay > 0
    ) {
      baselineHourlyPay = beforeMetrics.avgHourlyPay;
    } else if (afterMetrics.avgHourlyPay > 0) {
      baselineHourlyPay = afterMetrics.avgHourlyPay;
    }
  }

  // Final sanity check: ALWAYS cap unrealistic rates, regardless of data amount
  // This ensures we don't show inflated earnings when Argyle data has outliers
  const MAX_REASONABLE_HOURLY_RATE = 50; // Conservative cap for realistic estimates

  // ALWAYS apply cap if rate is unrealistic OR data is sparse
  // This prevents $500/hour rates even with sparse data
  if (
    baselineHourlyPay > MAX_REASONABLE_HOURLY_RATE ||
    combinedHours < MIN_HOURS_FOR_RELIABLE_RATE
  ) {
    // Try to find a reasonable rate from weekly data (filtering outliers)
    let reasonableRate = 0;

    if (beforeMetrics.weeklyData || afterMetrics.weeklyData) {
      const allWeeklyRates: number[] = [];

      // Collect weekly rates, filtering out obvious outliers (> $100/hour)
      if (beforeMetrics.weeklyData) {
        beforeMetrics.weeklyData.forEach((week) => {
          if (week.totalOnlineHours > 0 && week.avgHourlyPay > 0 && week.avgHourlyPay <= 100) {
            allWeeklyRates.push(week.avgHourlyPay);
          }
        });
      }
      if (afterMetrics.weeklyData) {
        afterMetrics.weeklyData.forEach((week) => {
          if (week.totalOnlineHours > 0 && week.avgHourlyPay > 0 && week.avgHourlyPay <= 100) {
            allWeeklyRates.push(week.avgHourlyPay);
          }
        });
      }

      if (allWeeklyRates.length > 0) {
        // Use median of reasonable weekly rates
        allWeeklyRates.sort((a, b) => a - b);
        const medianIndex = Math.floor(allWeeklyRates.length / 2);
        const medianRate =
          allWeeklyRates.length % 2 === 0
            ? (allWeeklyRates[medianIndex - 1] + allWeeklyRates[medianIndex]) / 2
            : allWeeklyRates[medianIndex];

        reasonableRate = Math.min(medianRate, MAX_REASONABLE_HOURLY_RATE);
      }
    }

    // If we found a reasonable rate, use it; otherwise use conservative default
    if (reasonableRate > 0) {
      baselineHourlyPay = reasonableRate;
    } else {
      // No reasonable weekly rates found - use conservative default
      baselineHourlyPay = MAX_REASONABLE_HOURLY_RATE;
    }
  }

  // Final absolute cap: NEVER allow rates above $50/hour, regardless of calculation method
  // This is a hard limit to prevent any unrealistic earnings estimates
  if (baselineHourlyPay > MAX_REASONABLE_HOURLY_RATE) {
    baselineHourlyPay = MAX_REASONABLE_HOURLY_RATE;
  }

  // Calculate missed during deactivation period
  const deactivationDays = deactivationMetrics.workingDays;
  const expectedHoursAtBaseline = baselineDailyHours * deactivationDays;
  const actualHoursDuringDeactivation = deactivationMetrics.totalOnlineHours;

  // Missed hours = expected baseline hours - actual hours worked
  const missedHours = Math.max(0, expectedHoursAtBaseline - actualHoursDuringDeactivation);

  // Missed earnings = missed hours × baseline hourly pay
  const missedEarnings = missedHours * baselineHourlyPay;

  return {
    missedHours,
    missedEarnings,
    baselineDailyHours,
    baselineHourlyPay
  };
}

/**
 * Map frontend platform (e.g. 'uber', 'lyft') to argyle_driver_activities employer value.
 */
export function employerFilterForPlatform(platform: string | null | undefined): string | undefined {
  if (!platform || platform === 'all') return undefined;
  const p = platform.toLowerCase();
  if (p === 'uber') return 'Uber Driver';
  if (p === 'lyft') return 'Lyft Driver';
  return undefined;
}

/**
 * Get driver activities for a user within a date range.
 * Optional employerFilter: e.g. 'Uber Driver', 'Lyft Driver' to restrict to one platform.
 */
export async function getDriverActivitiesForPeriod(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date,
  employerFilter?: string
): Promise<ArgyleDriverActivity[]> {
  // Get user's argyle accounts
  const { data: argyleAccountData, error: argyleAccountError } = await supabase
    .from('argyle_accounts')
    .select('argyle_account')
    .eq('user_id', userId);

  if (argyleAccountError || !argyleAccountData || argyleAccountData.length === 0) {
    return [];
  }

  const accounts = argyleAccountData.map((a: { argyle_account: string }) => a.argyle_account);

  let query = supabase
    .from('argyle_driver_activities')
    .select('*')
    .in('account', accounts)
    .gte('start_datetime', moment(startDate).startOf('day').toISOString())
    .lte('start_datetime', moment(endDate).endOf('day').toISOString())
    .order('start_datetime', { ascending: true });

  if (employerFilter) {
    query = query.eq('employer', employerFilter);
  }

  const { data: activities, error } = await query;

  if (error) {
    throw new Error(`Could not fetch activities: ${error.message}`);
  }

  return activities || [];
}
