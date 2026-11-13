import { http, HttpResponse } from 'msw';
import { generateMockedArgyleIdentityResponse } from './mocks/identities';
import { generateMockedArgyleGigsResponse } from './mocks/activities';
import type { ArgyleGigsResponse } from '../src/lib/types';

// get env
import { config } from 'dotenv';

config(); // Load env vars

const PUB_VITE_TWILIO_SID = process.env.PUB_VITE_TWILIO_SID;

// In this file we'll set up the services we need to mock, including argyle
// and supabase.

export const handlers = [
  // Mock Argyle user creation (used in demo login flow)
  http.post('http://argyletestingurl.test/v2/users', async () => {
    // Generate a valid UUID v4 for the argyle user id
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return HttpResponse.json({
      id: uuid,
      user_token: 'test-token-' + Date.now(),
      message: 'User created successfully'
    });
  }),
  http.get('http://argyletestingurl.test/v2/gigs', async ({ request }) => {
    const url = new URL(request.url);
    const account = url.searchParams.get('account');

    const httpResponseJson: ArgyleGigsResponse = generateMockedArgyleGigsResponse(account);
    return HttpResponse.json(httpResponseJson);
  }),
  http.get(`http://argyletestingurl.test/v2/identities`, async () => {
    return HttpResponse.json({
      results: [generateMockedArgyleIdentityResponse()]
    });
  }),
  http.post(
    `https://api.twilio.com/2010-04-01/Accounts/${PUB_VITE_TWILIO_SID}/Messages.json`,
    async () => {
      return HttpResponse.json({
        account_sid: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        api_version: '2010-04-01',
        body: 'This is the ship that made the Kessel Run in fourteen parsecs?',
        date_created: 'Thu, 24 Aug 2023 05:01:45 +0000',
        date_sent: 'Thu, 24 Aug 2023 05:01:45 +0000',
        date_updated: 'Thu, 24 Aug 2023 05:01:45 +0000',
        direction: 'outbound-api',
        error_code: null,
        error_message: null,
        from: '+15017122661',
        num_media: '0',
        num_segments: '1',
        price: null,
        price_unit: null,
        messaging_service_sid: 'MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        sid: 'SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        status: 'queued',
        to: '+15558675310',
        uri: '/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages/SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.json'
      });
    }
  ),
  http.options(
    'https://api.twilio.com/2010-04-01/Accounts/AC00000000000000000000000000000000/Messages.json',
    async () => {
      return HttpResponse.json({});
    }
  )
];
