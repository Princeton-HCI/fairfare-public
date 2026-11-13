/* eslint-disable @typescript-eslint/ban-ts-comment */

import { supabase } from '@src/lib/server/db';
import { load } from './+page.server';

describe('load function in +page.server.ts', () => {
  beforeAll(async () => {
    // Ensure the affiliate org exists. `onConflict: 'key'` matters: without it
    // the upsert conflicts on the primary key only, so a row left by an earlier
    // run fails this on affiliate_organizations_key_key.
    const { error: upsertOrgError } = await supabase.from('affiliate_organizations').upsert(
      {
        key: 'edl',
        name: 'EDL',
        url: 'https://example.org'
      },
      { onConflict: 'key' }
    );
    if (upsertOrgError) throw upsertOrgError;
  });
  describe('missing survey_response_id', () => {
    it('returns a 400 error', async () => {
      // Create a mock event object
      const event = {
        params: { studyShortcode: 'edl' },
        url: { searchParams: new URLSearchParams('') },
        locals: { safeGetSession: () => Promise.resolve({ user_id: '123' }) }
        // Add other properties as needed
      };

      try {
        // @ts-ignore svelte-check: type mismatch
        await load(event);
        expect.fail('Expected an error to be thrown'); // If load doesn't throw, fail the test
      } catch (e) {
        // @ts-expect-error 'e' is of type 'unknown'.ts(18046)
        expect(e.status).toBe(400);
        // @ts-expect-error 'e' is of type 'unknown'.ts(18046)
        expect(e.body.message).toBe(
          'A survey_response_id is required in the request URL. You must complete the survey before continuing in this study.'
        );
      }
    });
  });
});
