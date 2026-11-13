import { blockUnhandledRequests, unexpectedRequests } from './setupTests';

// An unmocked request must fail the test even if application code catches its
// network error. Unit tests must not silently rely on a running Supabase.
blockUnhandledRequests();
afterEach(() => {
  const requests = unexpectedRequests.splice(0);
  expect(requests, 'Unit tests must mock all network dependencies').toEqual([]);
});
