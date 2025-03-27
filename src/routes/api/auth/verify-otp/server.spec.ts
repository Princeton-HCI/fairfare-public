import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';

describe('POST /api/auth/verify-otp/', () => {
  describe('when verifyOtp returns a session', () => {
    it('returns a 200', async () => {
      const user = await createTestUserByEmail('verifyOtp200s@test.test');

      // update the phone number
      await updateProfileByUserId(supabase, user.id, {
        phone: '19995552222'
      });

      const verifyOtpSpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const response = await POST({
        request: {
          clone: () => ({
            // Note that this token is hardcoded to always work in the config.toml
            // @ts-expect-error Type '{ userId: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
            json: () => ({ token: '552222', userId: user.id })
          })
        }
      });
      await teardownTestUserByUserId(user.id);

      expect(response.status).toEqual(200);

      expect(verifyOtpSpy).toHaveBeenCalledWith({
        phone: '19995552222',
        token: '552222',
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
      const user = await createTestUserByEmail('verifyOtpFalse@test.test');

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
      const user = await createTestUserByEmail('withPhoneNumberReturns200@test.test');

      // update the phone number
      await updateProfileByUserId(supabase, user.id, {
        phone: '19995559999'
      });

      const verifyOtpSpy = vi.spyOn(supabase.auth, 'verifyOtp');

      const response = await POST({
        request: {
          clone: () => ({
            // @ts-expect-error Type '{ userId: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]ts(2739)
            json: () => ({ token: '559999', phone: '19995559999' })
          })
        }
      });

      expect(response.status).toEqual(200);

      expect(verifyOtpSpy).toHaveBeenCalledWith({
        phone: '19995559999',
        token: '559999',
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
