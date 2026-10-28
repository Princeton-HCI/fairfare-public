import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { supabase } from '@src/lib/server/db';
import { getDriverIds } from '../policy_analysis/shared';
import { ANALYSIS_SCOPE_DENIED, canAccessAnalysisScope } from '@src/routes/organizer/utils.server';

export const POST: RequestHandler = async ({ request, locals, url }) => {
  const { user, roles } = await locals.safeGetSession();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    filterStartDate,
    filterEndDate,
    startLocation,
    endLocation,
    locationCombiner,
    platforms,
    selectedScope
  } = body as {
    filterStartDate?: string;
    filterEndDate?: string;
    startLocation?: string;
    endLocation?: string;
    locationCombiner?: string;
    platforms?: string[];
    selectedScope?: string;
  };

  if (!selectedScope) {
    return Response.json({ error: 'selectedScope is required' }, { status: 400 });
  }

  if (!canAccessAnalysisScope(roles, selectedScope, 'export')) {
    return Response.json({ error: ANALYSIS_SCOPE_DENIED }, { status: 403 });
  }

  const orgKey = selectedScope === 'all' ? null : selectedScope;

  // Reject if user already has an active export
  const { data: existing } = await supabase
    .from('policy_analysis_exports')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['pending', 'processing'])
    .limit(1);

  if (existing && existing.length > 0) {
    return Response.json(
      { error: 'An export is already in progress', existingId: existing[0].id },
      { status: 409 }
    );
  }

  let driverIds: string[] | null = null;
  if (orgKey) {
    // Use the client the scope check handed back (service role): a platform
    // admin is authorized by capability, not membership, so the RLS client
    // would return zero drivers and 404 here.
    driverIds = await getDriverIds(supabase, orgKey);
    if (driverIds.length === 0) {
      return Response.json({ error: 'No drivers found for this organization' }, { status: 404 });
    }
  }

  const filters = {
    startDate: filterStartDate || null,
    endDate: filterEndDate || null,
    startLocation: startLocation || null,
    endLocation: endLocation || null,
    locationCombiner: locationCombiner || 'OR',
    platforms: platforms || null,
    driverIds
  };

  const { data: exportRecord, error: insertError } = await supabase
    .from('policy_analysis_exports')
    .insert({
      user_id: user.id,
      organization_key: orgKey ?? 'all',
      filters
    })
    .select('id')
    .single();

  if (insertError || !exportRecord) {
    console.error('Failed to create export record:', insertError);
    return Response.json({ error: 'Failed to create export' }, { status: 500 });
  }

  // When running outside Netlify (dev, test, CI preview), process inline
  // since Netlify Background Functions aren't available.
  // On Netlify, invoke the background function which runs for up to 15 minutes.
  const isNetlify = !!env.NETLIFY;
  if (!isNetlify) {
    const processUrl = `${url.origin}/api/process_pending_exports`;
    (async () => {
      let status = 'processing';
      while (status === 'processing') {
        try {
          const res = await fetch(processUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.INTERNAL_API_SECRET}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ exportId: exportRecord.id })
          });
          const data = await res.json();
          status = data.status ?? 'done';
        } catch (err) {
          console.error('[DEV] Export processing error:', err);
          break;
        }
      }
    })();
  } else {
    const bgFunctionUrl = `${url.origin}/.netlify/functions/processExport-background`;
    try {
      await fetch(bgFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportId: exportRecord.id })
      });
    } catch (err) {
      console.error('Failed to invoke background function (scheduled fallback will retry):', err);
    }
  }

  return Response.json({ id: exportRecord.id }, { status: 202 });
};
