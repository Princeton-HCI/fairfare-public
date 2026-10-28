import type { RequestHandler } from './$types';
import { computeDeactivationData } from '@src/lib/organizer/computeDeactivationData';

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const result = await computeDeactivationData(locals, {
    driverShortId: body.driverShortId,
    driverEmail: body.driverEmail,
    platform: body.platform,
    deactivationStart: body.deactivationStart,
    deactivationEnd: body.deactivationEnd,
    affiliateOrganizationKey: body.affiliateOrganizationKey
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
    return Response.json({ error: result.error }, { status: 500 });
  }

  const { data } = result;

  if (data.activities.length === 0) {
    return Response.json({
      error: 'No activities found for this period',
      beforeMetrics: null,
      deactivationMetrics: null,
      afterMetrics: null,
      missed: {
        missedHours: 0,
        missedEarnings: 0,
        baselineDailyHours: 0,
        baselineHourlyPay: 0
      },
      deactivationPeriodString: data.deactivationPeriodString
    });
  }

  return Response.json({
    beforeMetrics: data.beforeMetrics,
    deactivationMetrics: data.deactivationMetrics,
    afterMetrics: data.afterMetrics,
    missed: data.missed,
    deactivationPeriodString: data.deactivationPeriodString,
    driverEmail: body.driverEmail || '',
    platform: data.platform || 'all'
  });
};
