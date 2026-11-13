import { supabase as serverSupabase } from '@src/lib/server/db';
import {
  getDriverActivitiesForPeriod,
  calculatePeriodMetrics,
  calculateMissedOpportunities,
  estimateDeactivationPeriodFromBaseline,
  employerFilterForPlatform,
  MIN_HOURS_FOR_RELIABLE_RATE,
  type PeriodMetrics,
  type MissedOpportunities
} from '@src/lib/onlineTimeEstimation';
import moment from 'moment';
import short from 'short-uuid';
import { hasCapability, type Capability } from '@src/lib/rbac';

type ArgyleDriverActivity = SupabaseRows['argyle_driver_activities'];

export interface DeactivationData {
  driverProfile: { user_id: string; first_name: string | null; last_initial: string | null };
  driverId: string;
  beforeMetrics: PeriodMetrics;
  afterMetrics: PeriodMetrics;
  deactivationMetrics: PeriodMetrics;
  missed: MissedOpportunities;
  activities: ArgyleDriverActivity[];
  beforeStart: Date;
  beforeEnd: Date;
  deactivationStartDate: Date;
  deactivationEndDate: Date;
  afterStart: Date;
  afterEnd: Date;
  platform: string;
  deactivationPeriodString: string;
}

export interface ComputeDeactivationDataParams {
  driverShortId: string;
  /** Optional; PDF/download may use empty string when the profile has no email. */
  driverEmail?: string;
  platform: string;
  deactivationStart: string;
  deactivationEnd: string;
  affiliateOrganizationKey: string;
  /**
   * Capability required on the organization. Viewing the tool needs
   * `org:view_driver_pii`; downloading the report needs `org:export_driver_data`.
   */
  capability?: Capability;
}

export type ComputeDeactivationDataResult =
  | { ok: true; data: DeactivationData }
  | { ok: false; status: 401 }
  | { ok: false; status: 400 }
  | { ok: false; status: 403 }
  | { ok: false; status: 500; error: string };

/**
 * Shared logic for deactivation tool data and download-deactivation-report.
 * Performs auth, access check, date parsing, activity fetch, and metrics computation.
 */
export async function computeDeactivationData(
  locals: App.Locals,
  params: ComputeDeactivationDataParams
): Promise<ComputeDeactivationDataResult> {
  const { session, roles } = await locals.safeGetSession();
  if (session === null) {
    return { ok: false, status: 401 };
  }

  const {
    driverShortId,
    platform,
    deactivationStart,
    deactivationEnd,
    affiliateOrganizationKey,
    capability = 'org:view_driver_pii'
  } = params;

  if (!driverShortId || !platform || !deactivationStart || !deactivationEnd) {
    return { ok: false, status: 400 };
  }

  if (!affiliateOrganizationKey) {
    return { ok: false, status: 400 };
  }

  if (!hasCapability(roles, capability, affiliateOrganizationKey)) {
    return { ok: false, status: 403 };
  }

  const translator = short();
  const driverId = translator.toUUID(driverShortId);

  // Service-role read: researchers have no row-level grant to profiles (see
  // docs/rbac.md), so the user's RLS client would return nothing for them.
  // The `!inner` join on the organization key is what scopes the driver to
  // `affiliateOrganizationKey`, the same check `driverBelongsToOrganization` does.
  const { data: driverProfile, error: profileError } = await serverSupabase
    .from('profiles')
    .select(
      `
        user_id,
        first_name,
        last_initial,
        driver_affiliate_organization_data_sharing_consents!inner(
          affiliate_organization:affiliate_organizations!inner(
            key
          )
        )
      `
    )
    .eq('user_id', driverId)
    .eq(
      'driver_affiliate_organization_data_sharing_consents.affiliate_organization.key',
      affiliateOrganizationKey
    )
    .single();

  if (profileError || !driverProfile) {
    return { ok: false, status: 403 };
  }

  try {
    const deactivationStartDate = moment(deactivationStart).toDate();
    const deactivationEndDate = moment(deactivationEnd).toDate();

    const beforeEnd = moment(deactivationStartDate).subtract(1, 'day').toDate();
    const beforeStart = moment(deactivationStartDate).subtract(12, 'weeks').toDate();
    const afterStart = moment(deactivationEndDate).add(1, 'day').toDate();
    const afterEnd = moment(deactivationEndDate).add(12, 'weeks').toDate();

    const allStartDate = moment(beforeStart).subtract(1, 'week').toDate();
    const allEndDate = moment(afterEnd).add(1, 'week').toDate();

    const employerFilter = employerFilterForPlatform(platform);
    const activities = await getDriverActivitiesForPeriod(
      serverSupabase,
      driverId,
      allStartDate,
      allEndDate,
      employerFilter
    );

    const beforeMetrics = calculatePeriodMetrics(activities, beforeStart, beforeEnd);
    const afterMetrics = calculatePeriodMetrics(activities, afterStart, afterEnd);

    const deactivationActivities = activities.filter((activity) => {
      if (!activity.start_datetime) return false;
      const activityDate = moment(activity.start_datetime);
      return (
        activityDate.isSameOrAfter(moment(deactivationStartDate).startOf('day')) &&
        activityDate.isSameOrBefore(moment(deactivationEndDate).endOf('day'))
      );
    });

    let deactivationMetrics: PeriodMetrics;
    if (deactivationActivities.length === 0) {
      deactivationMetrics = estimateDeactivationPeriodFromBaseline(
        beforeMetrics,
        afterMetrics,
        deactivationStartDate,
        deactivationEndDate
      );
    } else {
      deactivationMetrics = calculatePeriodMetrics(
        activities,
        deactivationStartDate,
        deactivationEndDate
      );
    }

    let missed = calculateMissedOpportunities(beforeMetrics, deactivationMetrics, afterMetrics);
    const combinedBaselineHours = beforeMetrics.totalOnlineHours + afterMetrics.totalOnlineHours;
    if (combinedBaselineHours < MIN_HOURS_FOR_RELIABLE_RATE) {
      missed = {
        missedHours: 0,
        missedEarnings: 0,
        baselineDailyHours: 0,
        baselineHourlyPay: 0
      };
    }
    const deactivationPeriodString = `${moment(deactivationStart).format('MMMM D, YYYY')} - ${moment(deactivationEnd).format('MMMM D, YYYY')}`;

    return {
      ok: true,
      data: {
        driverProfile: {
          user_id: driverProfile.user_id,
          first_name: driverProfile.first_name,
          last_initial: driverProfile.last_initial
        },
        driverId,
        beforeMetrics,
        afterMetrics,
        deactivationMetrics,
        missed,
        activities,
        beforeStart,
        beforeEnd,
        deactivationStartDate,
        deactivationEndDate,
        afterStart,
        afterEnd,
        platform,
        deactivationPeriodString
      }
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, status: 500, error: errorMessage };
  }
}
