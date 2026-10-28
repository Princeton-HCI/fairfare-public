import type { Config } from '@netlify/functions';

/**
 * Organizer membership alerts are opt-in: `ORGANIZER_ALERT_EMAILS` holding at
 * least one recipient is what turns them on. With nothing configured the run is
 * skipped here, so a deployment that does not want alerts never calls the
 * endpoint at all. The same check guards the endpoint itself, for the case of a
 * recipient list that is emptied between this check and the request.
 */
const alertsEnabled = () =>
  (process.env.ORGANIZER_ALERT_EMAILS ?? '').split(',').some((email) => email.trim());

export default async () => {
  if (!alertsEnabled()) return Response.json({ disabled: true });

  const baseUrl = process.env.URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!baseUrl || !secret) {
    return Response.json({ error: 'Missing URL or INTERNAL_API_SECRET' }, { status: 500 });
  }
  const response = await fetch(`${baseUrl}/api/send_organizer_membership_alerts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` }
  });
  if (!response.ok) {
    console.error('Organizer membership alerts failed', response.status);
    return Response.json({ error: 'Alert processing failed' }, { status: 502 });
  }
  return Response.json(await response.json());
};

export const config: Config = { schedule: '*/5 * * * *' };
