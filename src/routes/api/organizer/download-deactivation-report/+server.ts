import JSZip from 'jszip';
import type { RequestHandler } from './$types';
import { type PeriodMetrics } from '@src/lib/onlineTimeEstimation';
import { computeDeactivationData } from '@src/lib/organizer/computeDeactivationData';
import { generateDeactivationReportPdf } from '@src/lib/deactivationReportPdf';
import moment from 'moment';

type ArgyleDriverActivity = SupabaseRows['argyle_driver_activities'];

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const result = await computeDeactivationData(locals, {
    driverShortId: body.driverShortId,
    driverEmail: body.driverEmail,
    platform: body.platform,
    deactivationStart: body.deactivationStart,
    deactivationEnd: body.deactivationEnd,
    affiliateOrganizationKey: body.affiliateOrganizationKey,
    capability: 'org:export_driver_data'
  });

  if (!result.ok) {
    if (result.status === 401) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (result.status === 400) {
      return new Response('Missing required parameters', { status: 400 });
    }
    if (result.status === 403) {
      return new Response('Driver not found or access denied', { status: 403 });
    }
    return new Response(
      JSON.stringify({
        error: 'Error generating report',
        message: result.error,
        details: ''
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { data } = result;
  if (data.activities.length === 0) {
    return new Response('No activities found for this period', { status: 404 });
  }

  const platformLabel =
    data.platform === 'uber' ? 'Uber' : data.platform === 'lyft' ? 'Lyft' : 'Uber & Lyft';

  const csv = generateDeactivationCsv(
    data.activities,
    data.beforeStart,
    data.beforeEnd,
    data.deactivationStartDate,
    data.deactivationEndDate,
    data.afterStart,
    data.afterEnd,
    data.beforeMetrics,
    data.deactivationMetrics,
    data.afterMetrics
  );

  const zip = new JSZip();
  const timestamp = moment().format('YYYYMMDD');
  const driverName =
    `${data.driverProfile.first_name || ''}_${data.driverProfile.last_initial || ''}`
      .replace(/[^a-zA-Z]+/g, '_')
      .toLowerCase();

  zip.file(`${driverName}_deactivation_data_${timestamp}.csv`, csv);

  const pdfBlob = await generateDeactivationReportPdf(
    `${data.driverProfile.first_name || ''} ${data.driverProfile.last_initial || ''}`.trim() ||
      body.driverEmail,
    body.driverEmail,
    platformLabel,
    data.beforeMetrics,
    data.deactivationMetrics,
    data.afterMetrics
  );
  zip.file(`${driverName}_deactivation_report_${timestamp}.pdf`, await pdfBlob.arrayBuffer(), {
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const zipContent = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return new Response(zipContent, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${driverName}_deactivation_report_${timestamp}.zip"`
    }
  });
};

type WeekDatum = {
  weekStart: moment.Moment;
  weekEnd: moment.Moment;
  period: 'Before' | 'During' | 'After';
  activities: ArgyleDriverActivity[];
};

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Only include activities within the period bounds (not just the calendar week). */
function filterActivitiesInWindow(
  list: ArgyleDriverActivity[],
  periodStart: moment.Moment,
  periodEnd: moment.Moment,
  weekStart: moment.Moment,
  weekEnd: moment.Moment
): ArgyleDriverActivity[] {
  const periodStartDay = periodStart.clone().startOf('day');
  const periodEndDay = periodEnd.clone().endOf('day');
  return list.filter((a) => {
    if (!a.start_datetime) return false;
    const date = moment(a.start_datetime);
    const inWeek = date.isSameOrAfter(weekStart) && date.isSameOrBefore(weekEnd);
    const inPeriod = date.isSameOrAfter(periodStartDay) && date.isSameOrBefore(periodEndDay);
    return inWeek && inPeriod;
  });
}

/** Build weekData for one period. During period: include weeks that overlap even if no activities. */
function buildWeekDataForPeriod(
  activities: ArgyleDriverActivity[],
  periodStart: Date,
  periodEnd: Date,
  period: WeekDatum['period']
): WeekDatum[] {
  const result: WeekDatum[] = [];
  const startM = moment(periodStart);
  const endM = moment(periodEnd);
  let current = moment(periodStart);
  while (current.isSameOrBefore(endM)) {
    const weekStart = current.clone().startOf('isoWeek');
    const weekEnd = weekStart.clone().endOf('isoWeek');
    const weekActivities = filterActivitiesInWindow(activities, startM, endM, weekStart, weekEnd);
    const includeEmptyDuring = period === 'During' && weekStart.isSameOrBefore(endM);
    if (weekActivities.length > 0 || includeEmptyDuring) {
      result.push({ weekStart, weekEnd, period, activities: weekActivities });
    }
    current = weekEnd.clone().add(1, 'day');
  }
  return result;
}

function generateDeactivationCsv(
  activities: ArgyleDriverActivity[],
  beforeStart: Date,
  beforeEnd: Date,
  deactivationStart: Date,
  deactivationEnd: Date,
  afterStart: Date,
  afterEnd: Date,
  _beforeMetrics: PeriodMetrics,
  _deactivationMetrics: PeriodMetrics,
  _afterMetrics: PeriodMetrics
): string {
  const weekData: WeekDatum[] = [
    ...buildWeekDataForPeriod(activities, beforeStart, beforeEnd, 'Before'),
    ...buildWeekDataForPeriod(activities, deactivationStart, deactivationEnd, 'During'),
    ...buildWeekDataForPeriod(activities, afterStart, afterEnd, 'After')
  ];

  const rows: string[][] = [
    [
      'Week',
      'Period',
      'Screenshot Hours',
      'Predicted Actual Hours',
      'Net Fare',
      'Hourly Pay',
      'Trips'
    ]
  ];

  for (const week of weekData) {
    const totalHours = week.activities.reduce((sum, a) => {
      if (a.start_datetime && a.end_datetime) {
        return sum + moment(a.end_datetime).diff(moment(a.start_datetime), 'hours', true);
      }
      return sum + (a.duration || 0) / 3600;
    }, 0);

    const totalEarnings = week.activities.reduce((sum, a) => sum + (a.income_total || 0), 0);
    const totalTrips = week.activities.length;

    // For now, use actual hours as "predicted" (since we're using Argyle data)
    // Screenshot hours would be estimated using inverse model
    const predictedHours = totalHours;
    const hourlyPay = totalHours > 0 ? totalEarnings / totalHours : 0;

    rows.push([
      `${week.weekStart.format('MM/DD/YY')} - ${week.weekEnd.format('MM/DD/YY')}`,
      week.period === 'During' ? 'During Deactivation' : `${week.period} Deactivation`,
      predictedHours.toFixed(2), // Screenshot hours (estimated)
      predictedHours.toFixed(2), // Predicted actual hours
      totalEarnings.toFixed(2),
      hourlyPay.toFixed(2),
      totalTrips.toString()
    ]);
  }

  return rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
}
