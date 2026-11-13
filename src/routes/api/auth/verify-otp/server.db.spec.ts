import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import {
  createTestUserByEmail,
  releaseTestPhone,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';

/**
 * These numbers are pinned to a fixed OTP in supabase/config.toml, so they
 * cannot be unique per run — they are a shared resource. This file owns them
 * exclusively (send-otp has its own set), so it can run alongside the rest of
 * the suite. Free them first, in case an earlier run died before its teardown.
 */
const PINNED_PHONES = ['19995551111', '19998882222', '19995553333'];

beforeAll(async () => {
  for (const phone of PINNED_PHONES) await releaseTestPhone(phone);
});

afterAll(async () => {
  for (const phone of PINNED_PHONES) await releaseTestPhone(phone);
});

describe('POST /api/auth/verify-otp/', () => {
  describe('when verifyOtp returns a session', () => {
    it('returns a 200', async () => {
      const user = await createTestUserByEmail(uniqueTestEmail('verifyotp200s'));

      // update the phone number
      await updateProfileByUserId(supabase, user.id, {
        phone: '19995551111'
      });

      const verifyOtpSpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const response = await POST({
        request: {
          clone: () => ({
            // Note that this token is hardcoded to always work in the config.toml
            // @ts-expect-error Type '{ userId: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
            json: () => ({ token: '551111', userId: user.id })
          })
        }
      });
      await teardownTestUserByUserId(user.id);

      expect(response.status).toEqual(200);

      expect(verifyOtpSpy).toHaveBeenCalledWith({
        phone: '19995551111',
        token: '551111',
        type: 'sms'
      });

      const verifyOtpSpyResult = await verifyOtpSpy.mock.results[0].value;
      expect(verifyOtpSpyResult.error).toEqual(null);
      expect(verifyOtpSpyResult.data.session).toBeDefined();
      expect(verifyOtpSpyResult.data.user.id).toEqual(user.id);
    });
  });
  describe('when submitting an invalid token', () => {
    it('returns a 400', async () => {
      const user = await createTestUserByEmail(uniqueTestEmail('verifyotpfalse'));

      // update the phone number
      await updateProfileByUserId(supabase, user.id, {
        phone: '19998882222'
      });

      const response = await POST({
        request: {
          clone: () => ({
            // This token is invalid!
            // @ts-expect-error Type '{ userId: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
            json: () => ({ token: '000000', userId: user.id })
          })
        }
      });

      expect(response.status).toEqual(400);
      // check response content
      expect(await response.text()).toEqual('Token has expired or is invalid');
    });
  });
  describe('with no otp token', () => {
    it('returns a 400', async () => {
      const response = await POST({
        request: {
          clone: () => ({
            // @ts-expect-error Type '{ userId: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
            json: () => ({ userId: '1234' })
          })
        }
      });
      expect(response.status).toEqual(400);
    });
  });
  describe('with no userId or phone number', () => {
    it('returns a 400', async () => {
      const response = await POST({
        request: {
          clone: () => ({
            // @ts-expect-error Type '{ userId: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
            json: () => ({ token: '123456' })
          })
        }
      });
      expect(response.status).toEqual(400);
    });
  });
  describe('with phone number and valid token', () => {
    it('returns a 200', async () => {
      // make a user with the phone number'
      const user = await createTestUserByEmail(uniqueTestEmail('withphonenumberreturns200'));

      // update the phone number
      await updateProfileByUserId(supabase, user.id, {
        phone: '19995553333'
      });

      const verifyOtpSpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const response = await POST({
        request: {
          clone: () => ({
            // @ts-expect-error Type '{ userId: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
            json: () => ({ token: '553333', phone: '19995553333' })
          })
        }
      });

      expect(response.status).toEqual(200);

      expect(verifyOtpSpy).toHaveBeenCalledWith({
        phone: '19995553333',
        token: '553333',
        type: 'sms'
      });

      const verifyOtpSpyResult = await verifyOtpSpy.mock.results[0].value;
      expect(verifyOtpSpyResult.error).toEqual(null);
      expect(verifyOtpSpyResult.data.session).toBeDefined();
      expect(verifyOtpSpyResult.data.user.id).toEqual(user.id);

      await teardownTestUserByUserId(user.id);
    });
  });
});
