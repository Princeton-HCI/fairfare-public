import { test, expect } from '@playwright/test';
import { createHmac, randomUUID } from 'crypto';
import { createTestUserWithArgyleUser, teardownTestUser } from './utils/playwrightSupabase';

/**
 * Against the stub (tests/argyleStub.ts) these ids are arbitrary — it answers
 * for any user, account or identity. They used to be three real ids copied out
 * of the Argyle sandbox, under a comment warning they expire after 60 days —
 * when they did, CI failed for everyone with a 500 that looked like a code bug.
 *
 * ARGYLE_LIVE=1 points the app at the real sandbox, where random ids identify
 * nothing. Live runs therefore need ids of currently connected sandbox
 * resources, passed in explicitly; without them these specs skip rather than
 * fail against the sandbox for a reason that has nothing to do with the app.
 */
const useLiveArgyle = process.env.ARGYLE_LIVE === '1';
const liveIdsProvided = Boolean(
  process.env.ARGYLE_LIVE_USER &&
    process.env.ARGYLE_LIVE_ACCOUNT &&
    process.env.ARGYLE_LIVE_IDENTITY
);

const ARGYLE_USER = process.env.ARGYLE_LIVE_USER ?? randomUUID();
const ARGYLE_ACCOUNT = process.env.ARGYLE_LIVE_ACCOUNT ?? randomUUID();
const ARGYLE_IDENTITY = process.env.ARGYLE_LIVE_IDENTITY ?? randomUUID();

test.skip(
  useLiveArgyle && !liveIdsProvided,
  'ARGYLE_LIVE=1 needs ARGYLE_LIVE_USER, ARGYLE_LIVE_ACCOUNT and ARGYLE_LIVE_IDENTITY ' +
    'from a connected sandbox account; generated ids do not exist there.'
);

// Helper to create signed webhook request
function createSignedWebhookRequest(payload: object) {
  const secret = process.env.ARGYLE_WEBHOOK_SECRET || 'test-webhook-secret';
  const body = JSON.stringify(payload);
  const signature = createHmac('sha512', secret).update(body).digest('hex');

  return {
    data: body,
    headers: {
      'Content-Type': 'application/json',
      'X-Argyle-Signature': signature
    }
  };
}

test.describe('receives incoming Argyle identities.added webhook', () => {
  const payload = {
    event: 'identities.added',
    name: 'ALL_development',
    data: {
      account: ARGYLE_ACCOUNT,
      user: ARGYLE_USER,
      identity: ARGYLE_IDENTITY
    }
  };

  let testUserId: string;

  test.beforeEach(async () => {
    testUserId = await createTestUserWithArgyleUser(ARGYLE_USER);
  });

  test.afterEach(async () => {
    if (testUserId) {
      await teardownTestUser(testUserId);
    }
  });

  test('Should 200', async ({ request }) => {
    const response = await request.post(
      '/api/driver/argyle/webhooks',
      createSignedWebhookRequest(payload)
    );
    expect(response.status()).toBe(200);
  });
});

test.describe('receives incoming Argyle identities.updated webhook', () => {
  const payload = {
    event: 'identities.updated',
    name: 'ALL_development',
    data: {
      account: ARGYLE_ACCOUNT,
      user: ARGYLE_USER,
      identity: ARGYLE_IDENTITY
    }
  };

  let testUserId: string;

  test.beforeEach(async () => {
    testUserId = await createTestUserWithArgyleUser(ARGYLE_USER);
  });

  test.afterEach(async () => {
    if (testUserId) {
      await teardownTestUser(testUserId);
    }
  });

  test('Should 200', async ({ request }) => {
    const response = await request.post(
      '/api/driver/argyle/webhooks',
      createSignedWebhookRequest(payload)
    );
    expect(response.status()).toBe(200);
  });
});

test.describe('receives incoming Argyle gigs.partially_synced webhook', () => {
  const payload = {
    event: 'gigs.partially_synced',
    name: 'ALL_development',
    data: {
      account: ARGYLE_ACCOUNT,
      user: ARGYLE_USER,
      available_from: '2023-08-23T20:59:28Z',
      available_to: '2023-10-18T09:30:35Z',
      available_count: 149,
      days_synced: 55
    }
  };

  test('Should 200', async ({ request }) => {
    const response = await request.post(
      '/api/driver/argyle/webhooks',
      createSignedWebhookRequest(payload)
    );
    expect(response.status()).toBe(200);
  });
});

test.describe('receives incoming Argyle gigs.fully_synced webhook', () => {
  const payload = {
    event: 'gigs.fully_synced',
    name: 'ALL_development',
    data: {
      account: ARGYLE_ACCOUNT,
      user: ARGYLE_USER,
      available_from: '2020-10-19T20:21:03Z',
      available_to: '2023-10-18T09:30:35Z',
      available_count: 2576
    }
  };

  test('Should 200', async ({ request }) => {
    const response = await request.post(
      '/api/driver/argyle/webhooks',
      createSignedWebhookRequest(payload)
    );
    expect(response.status()).toBe(200);
  });
});
