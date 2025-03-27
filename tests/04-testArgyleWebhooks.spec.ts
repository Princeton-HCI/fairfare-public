import { test, expect } from '@playwright/test';

test.describe('receives incoming Argyle identities.added webhook', () => {
  const postContent = {
    event: 'identities.added',
    name: 'ALL_development',
    data: {
      account: '018b4472-cc2d-0559-dab9-cb065a245600',
      user: '018b4449-65ed-61e5-c75d-78a6264e409d',
      identity: '018b4472-f251-61e7-f071-b7b126f59cd0'
    }
  };

  test('Should 200', async ({ request }) => {
    const response = await request.post('/api/driver/argyle/webhooks', postContent);
    expect(response.status()).toBe(200);
  });
});

test.describe('receives incoming Argyle identities.updated webhook', () => {
  const postContent = {
    event: 'identities.updated',
    name: 'ALL_development',
    data: {
      account: '018b4472-cc2d-0559-dab9-cb065a245600',
      user: '018b4449-65ed-61e5-c75d-78a6264e409d',
      identity: '018b4472-f251-61e7-f071-b7b126f59cd0'
    }
  };

  test('Should 200', async ({ request }) => {
    const response = await request.post('/api/driver/argyle/webhooks', postContent);
    expect(response.status()).toBe(200);
  });
});

test.describe('receives incoming Argyle gigs.partially_synced webhook', () => {
  const postContent = {
    event: 'gigs.partially_synced',
    name: 'ALL_development',
    data: {
      account: '018b4472-cc2d-0559-dab9-cb065a245600',
      user: '018b4449-65ed-61e5-c75d-78a6264e409d',
      available_from: '2023-08-23T20:59:28Z',
      available_to: '2023-10-18T09:30:35Z',
      available_count: 149,
      days_synced: 55
    }
  };

  test('Should 200', async ({ request }) => {
    const response = await request.post('/api/driver/argyle/webhooks', postContent);
    expect(response.status()).toBe(200);
  });
});

test.describe('receives incoming Argyle gigs.fully_synced webhook', () => {
  const postContent = {
    event: 'gigs.fully_synced',
    name: 'ALL_development',
    data: {
      account: '018b4472-cc2d-0559-dab9-cb065a245600',
      user: '018b4449-65ed-61e5-c75d-78a6264e409d',
      available_from: '2020-10-19T20:21:03Z',
      available_to: '2023-10-18T09:30:35Z',
      available_count: 2576
    }
  };

  test('Should 200', async ({ request }) => {
    const response = await request.post('/api/driver/argyle/webhooks', postContent);
    expect(response.status()).toBe(200);
  });
});

test.describe('receives incoming Argyle gigs.added webhook', () => {
  // TODO: add test for gigs.added
});

test.describe('receives incoming Argyle other webhook', () => {
  const postContent = {
    event: 'users.fully_synced',
    name: 'ALL_development',
    data: {
      user: '018b4449-65ed-61e5-c75d-78a6264e409d',
      resource: {
        id: '018b4449-65ed-61e5-c75d-78a6264e409d',
        items_connected: ['item_000041078'],
        employers_connected: ['Uber'],
        external_metadata: {},
        created_at: '2023-10-18T19:35:42.830534Z'
      }
    }
  };
  // TODO: set this up
});
