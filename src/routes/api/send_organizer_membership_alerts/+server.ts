import { json, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { validateInternalApiKey } from '@src/lib/server/internalAuth';
import { processOrganizerMembershipAlerts } from '@src/lib/server/organizerMembershipAlerts';

export const POST = async ({ request }: RequestEvent) => {
  validateInternalApiKey(request);
  const result = await processOrganizerMembershipAlerts(supabase);
  // 502: at least one delivery failed this run (it will be retried or was
  // abandoned). A deployment with no recipients has alerts switched off, which
  // is a 200 no-op rather than an error.
  const status = result.failed || result.abandoned ? 502 : 200;
  return json(result, { status });
};
