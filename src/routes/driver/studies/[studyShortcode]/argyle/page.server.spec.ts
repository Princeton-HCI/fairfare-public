/* eslint-disable @typescript-eslint/ban-ts-comment */

import { supabase } from '@src/lib/server/db';
import { load } from './+page.server';
import { teardownTestUserByUserId } from '@tests/utils/testUser';
import * as argyle from '@src/lib/server/argyle';

describe('load function in +page.server.ts', () => {
  beforeAll(async () => {
    // ensure affiliate org exists
    const { error: upsertOrgError } = await supabase.from('affiliate_organizations').upsert({
      key: 'edl',
      name: 'EDL',
      url: 'https://edl.org/'
    });
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
  describe('with a not logged in user', () => {
    describe('with a survey_response_id, platforms, and custom post_sync value', () => {
      it('returns the expected data, 200s, and updates the database with study_participations and org affiliation', async () => {
        // Mock argyleFetch

        const mockResponse = new Response(
          JSON.stringify({
            user_token: 'mocked_user_token',
            id: 'eeddaabb-ccdd-1122-3344-556677889900'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        // Mock the argyleFetch function
        vi.spyOn(argyle, 'argyleFetch').mockResolvedValue(mockResponse);

        // Create a mock event object
        const event = {
          params: { studyShortcode: 'edl' },
          url: {
            searchParams: new URLSearchParams(
              'survey_response_id=abcd12345&platforms=uber,lyft&post_sync=do-nothing'
            )
          },
          locals: { safeGetSession: () => Promise.resolve({ user: null, session: null }) }
          // Add other properties as needed
        };

        // @ts-ignore svelte-check: type mismatch
        const response = await load(event);

        expect(response.session.access_token).toBeDefined();
        expect(response.affiliateOrganization.name).toEqual('EDL');
        expect(response.studyDetails).toEqual({
          title: 'EDL',
          shortcode: 'edl'
        });
        expect(response.surveyResponseId).toBe('abcd12345');
        expect(response.argyleLinkIds).toEqual(['item_000024123', 'item_000041078']);

        // confirm study_participations
        const { data: studyParticipation, error: studyParticipationError } = await supabase
          .from('study_participations')
          .select('*')
          .eq('survey_response_id', 'abcd12345')
          .single();
        expect(studyParticipationError).toBe(null);
        expect(studyParticipation.post_sync).toBe('do-nothing');

        const user_id = studyParticipation.user_id;

        // confirm affiliate_organizations
        const {
          data: affiliateOrganizationAffiliation,
          error: affiliateOrganizationAffiliationError
        } = await supabase
          .from('driver_affiliate_organization_affiliations')
          .select('*, affiliate_organizations ( key )')
          .eq('user_id', user_id)
          .single();
        expect(affiliateOrganizationAffiliationError).toBe(null);
        expect(affiliateOrganizationAffiliation.affiliate_organizations.key).toBe('edl');

        await teardownTestUserByUserId(response.session.user.id);
      });
    });
  });
});
