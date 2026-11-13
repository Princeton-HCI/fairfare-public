// docs: https://docs.netlify.com/functions/scheduled-functions/

import type { Config } from '@netlify/functions';

export default async () => {
  const baseUrl = process.env.URL;
  const internalApiSecret = process.env.INTERNAL_API_SECRET;

  if (!internalApiSecret) {
    console.error('INTERNAL_API_SECRET environment variable is not set');
    return Response.json({ error: 'Configuration error' }, { status: 500 });
  }

  const path = baseUrl + '/api/send_pending_sms_messages';
  const url = new URL(path);

  const apiResponse = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${internalApiSecret}`
    }
  });

  const data = await apiResponse.json();

  if (data.success === true) {
    console.log('ok');
  } else {
    console.log('failure. api response: ', data);
  }
  return Response.json({ apiResponse: data });
};

export const config: Config = {
  schedule: '@hourly'
};
