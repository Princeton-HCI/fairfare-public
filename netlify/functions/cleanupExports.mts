/**
 * Daily scheduled function: deletes export records and storage files
 * older than 14 days.
 */

import type { Config } from '@netlify/functions';

export default async () => {
  const baseUrl = process.env.URL;
  const internalApiSecret = process.env.INTERNAL_API_SECRET;

  if (!baseUrl || !internalApiSecret) {
    console.error('Missing required env vars: URL or INTERNAL_API_SECRET');
    return Response.json({ error: 'Configuration error' }, { status: 500 });
  }

  try {
    const cleanupUrl = new URL(baseUrl + '/api/cleanup_old_exports');
    const res = await fetch(cleanupUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${internalApiSecret}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      console.error(`Cleanup endpoint returned ${res.status}: ${res.statusText}`);
      return Response.json({ error: 'Cleanup endpoint failed' }, { status: 502 });
    }

    const data = await res.json();
    console.log(`Cleanup complete: deleted ${data.deleted ?? 0} expired exports`);
    return Response.json(data);
  } catch (err) {
    console.error('Cleanup call failed:', err);
    return Response.json({ error: 'Cleanup call failed' }, { status: 500 });
  }
};

export const config: Config = {
  schedule: '0 3 * * *'
};
