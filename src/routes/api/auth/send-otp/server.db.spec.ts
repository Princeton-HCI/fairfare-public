import { POST } from './+server';

import {
  createTestUserByEmail,
  releaseTestPhone,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import { supabase } from '@src/lib/server/db';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';

/**
 * These numbers are pinned to a fixed OTP in supabase/config.toml, so they
 * cannot be unique per run — they are a shared resource. Free them first, in
 * case an earlier run died before its teardown.
 */
const PINNED_PHONES = ['19995552222', '19995559999', '12025552222'];

beforeAll(async () => {
  for (const phone of PINNED_PHONES) await releaseTestPhone(phone);
});

afterAll(async () => {
  for (const phone of PINNED_PHONES) await releaseTestPhone(phone);
});

describe('POST /api/auth/send-otp/', () => {
  describe('with formatted phoneNumber in the request body', () => {
    describe('a user that exists', () => {
      it('returns a 200 and calls signInWithOtp', async () => {
        // make a user with the phone number
        const user = await createTestUserByEmail(uniqueTestEmail('sendotpreturns200'));

        // update the phone number
        await updateProfileByUserId(supabase, user.id, {
          phone: '19995552222'
        });

        const signInWithOtpSpy = vi.spyOn(supabase.auth, 'signInWithOtp');

        const response = await POST({
          request: {
            clone: () => ({
              // @ts-expect-error Type '{ phoneNumber: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
              json: () => ({ phoneNumber: '+1 (999) 555-2222' })
            })
          }
        });
        expect(response.status).toEqual(200);

        expect(signInWithOtpSpy).toHaveBeenCalledWith({
          phone: '19995552222',
          options: {
            shouldCreateUser: false
          }
        });

        const signInWithOtpSpyResult = await signInWithOtpSpy.mock.results[0].value;
        expect(signInWithOtpSpyResult.error).toEqual(null);

        await teardownTestUserByUserId(user.id);
      });
    });
    describe('user does not exist', () => {
      it('returns 200, calls signInWithOtp and silently fails to avoid informing the user', async () => {
        const signInWithOtpSpy = vi.spyOn(supabase.auth, 'signInWithOtp');

        const response = await POST({
          request: {
            clone: () => ({
              // @ts-expect-error Type '{ phoneNumber: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
              json: () => ({ phoneNumber: '19995559999' })
            })
          }
        });

        expect(signInWithOtpSpy).toHaveBeenCalledWith({
          phone: '19995559999',
          options: {
            shouldCreateUser: false
          }
        });

        const signInWithOtpSpyResult = await signInWithOtpSpy.mock.results[0].value;
        expect(signInWithOtpSpyResult.error?.message).toEqual('Signups not allowed for otp');

        expect(response.status).toEqual(200);
      });
    });
  });
  describe('with userId in the request body', () => {
    it('returns 200 and calls signInWithOtp', async () => {
      // make a user with the phone number
      const user = await createTestUserByEmail(uniqueTestEmail('sendotpwithuserid200s'));

      // update the phone number
      await updateProfileByUserId(supabase, user.id, {
        phone: '12025552222'
      });

      const signInWithOtpSpy = vi.spyOn(supabase.auth, 'signInWithOtp');

      const response = await POST({
        request: {
          clone: () => ({
            // @ts-expect-error Type '{ phoneNumber: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
            json: () => ({ userId: user.id })
          })
        }
      });
      expect(response.status).toEqual(200);

      expect(signInWithOtpSpy).toHaveBeenCalledWith({
        phone: '12025552222',
        options: {
          shouldCreateUser: false
        }
      });

      const signInWithOtpSpyResult = await signInWithOtpSpy.mock.results[0].value;
      expect(signInWithOtpSpyResult.error).toEqual(null);

      await teardownTestUserByUserId(user.id);
    });
  });
  describe('with no userId or phoneNumber in the request body', () => {
    it('returns 400 when no userId or phoneNumber are passed', async () => {
      const response = await POST({
        request: {
          clone: () => ({
            // @ts-expect-error Type '{ phoneNumber: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
            json: () => ({ randomKey: 'aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })
          })
        }
      });
      expect(response.status).toEqual(400);
    });
  });
});
