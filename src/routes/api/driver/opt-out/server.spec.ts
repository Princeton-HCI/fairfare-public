/* eslint-disable @typescript-eslint/ban-ts-comment */

import { POST } from './+server';
import type { RequestEvent } from '@sveltejs/kit';

import { supabase } from '@src/lib/server/db';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';

type DriverSurveyInsert = SupabaseInserts['survey_fair_take_rate'];

describe('POST /api/driver/opt-out/', () => {
  describe('with a session', () => {
    it('deletes the user and their data and returns 200', async () => {
      // set up
      // if users, delete 'em
      const user = await createTestUserByEmail('api.driver.opt-out.deletes.user@test.test');
      const userId = user.id;

      // make a survey response
      const surveyResponse: DriverSurveyInsert = {
        user_id: userId,
        consents_to_more_surveys: false,
        what_you_think: 'I think this is a test'
      };

      const { data: surveyData, error: surveyError } = await supabase
        .from('survey_fair_take_rate')
        .insert([surveyResponse]);

      if (surveyError) {
        throw surveyError;
      }
      expect(surveyData).toBeDefined();

      // stub the supabase.auth.getUser method to return the user
      const userStub = {
        id: userId
      };
      // @ts-expect-error this is just a stub
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({ data: { user: userStub } });

      /* --- EXECUTION --- */

      // call the endpoint
      const request: RequestEvent = {
        locals: {
          // @ts-expect-error this is just a stub
          safeGetSession: async () => ({ session: {}, user: userStub })
        }
      };
      // @ts-ignore svelte-check: type mismatch
      const response = await POST(request as RequestEvent);

      /* --- VALIDATION --- */

      // expect the response to be a 200
      expect(response.status).toEqual(200);

      // expect user to be deleted
      const { data: deletedUserData, error: deletedUserError } =
        await supabase.auth.admin.getUserById(userStub.id);

      expect(deletedUserData).toStrictEqual({ user: null });
      expect(deletedUserError?.message).toBe('User not found');

      // expect survey to be deleted
      const { data: deletedSurveyData, error: deletedSurveyError } = await supabase
        .from('survey_fair_take_rate')
        .select('*')
        .eq('user_id', userStub.id);

      expect(deletedSurveyError).toBeNull();
      expect(deletedSurveyData?.length).toEqual(0);

      // reset mocks
      vi.resetAllMocks();

      teardownTestUserByUserId(userId);
    });
  });
  describe('with no session', () => {
    it('returns a 401', async () => {
      const request: RequestEvent = {
        locals: {
          // @ts-expect-error -- we're just testing the cookie here
          safeGetSession: async () => ({ session: null, user: null })
        }
      };
      // @ts-ignore svelte-check: type mismatch
      const response = await POST(request as RequestEvent);
      expect(response.status).toEqual(401);
    });
  });
});
