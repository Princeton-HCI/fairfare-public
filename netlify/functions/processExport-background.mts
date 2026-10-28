/**
 * Netlify Background Function for processing policy analysis exports.
 * Runs for up to 15 minutes. The client receives an immediate 202.
 * Loops calling the processing endpoint until the export is complete.
 *
 * @see https://docs.netlify.com/build/functions/background-functions/
 */

export default async (request: Request) => {
  const baseUrl = process.env.URL;
  const internalApiSecret = process.env.INTERNAL_API_SECRET;

  if (!baseUrl || !internalApiSecret) {
    console.error('Missing required env vars: URL or INTERNAL_API_SECRET');
    return;
  }

  let body: { exportId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine -- the scheduled fallback calls without one
  }

  const processUrl = `${baseUrl}/api/process_pending_exports`;
  let attempts = 0;
  const MAX_ATTEMPTS = 100;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    try {
      const res = await fetch(processUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${internalApiSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ exportId: body.exportId })
      });

      if (!res.ok) {
        console.error(`Process endpoint returned ${res.status}: ${res.statusText}`);
        await new Promise((r) => setTimeout(r, 2_000));
        continue;
      }

      const data = await res.json();

      if (!data.processed) {
        console.log('No pending exports to process');
        return;
      }

      if (data.status === 'completed') {
        console.log(`Export completed: ${data.totalRows} rows`);
        return;
      }

      if (data.status === 'failed') {
        console.error('Export failed:', data.error);
        return;
      }

      // status === 'processing' -- continue looping
      console.log(`Processing chunk: ${data.totalRows} rows so far`);
      await new Promise((r) => setTimeout(r, 2_000));
    } catch (err) {
      console.error('Error calling process endpoint:', err);
      // Wait before retrying on network errors
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }

  console.error(`Exceeded ${MAX_ATTEMPTS} attempts, stopping`);
};
