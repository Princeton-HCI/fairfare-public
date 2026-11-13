/**
 * Scheduled fallback: picks up any exports stuck in pending/processing
 * that the background function missed (e.g., if it crashed or wasn't invoked).
 */

import type { Config } from '@netlify/functions';

export default async () => {
  const baseUrl = process.env.URL;
  const internalApiSecret = process.env.INTERNAL_API_SECRET;

  if (!baseUrl || !internalApiSecret) {
    console.error('Missing required env vars: URL or INTERNAL_API_SECRET');
    return Response.json({ error: 'Configuration error' }, { status: 500 });
  }

  const apiResponse = await fetch(`${baseUrl}/api/process_pending_exports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${internalApiSecret}`,
      'Content-Type': 'application/json'
    }
  });

  if (!apiResponse.ok) {
    console.error(`Process endpoint returned ${apiResponse.status}: ${apiResponse.statusText}`);
    return Response.json({ error: 'Processing endpoint failed' }, { status: 502 });
  }

  const data = await apiResponse.json();

  if (data.processed) {
    console.log('Fallback processed export:', data.status, 'rows:', data.totalRows);
  } else {
    console.log('No pending exports');
  }

  return Response.json({ apiResponse: data });
};

export const config: Config = {
  schedule: '*/5 * * * *'
};
