/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for the demo mode login and data generation flows.
 *
 * These tests verify that the demo system works end-to-end without
 * hitting external APIs (Argyle, Twilio) or sending real SMS messages.
 *
 * Note: These tests require the local database to have the demo migrations applied.
 * Run `npx supabase db reset` if you encounter schema errors.
 */

import { describe, it, expect, vi, afterAll } from 'vitest';
import { v7 as uuidv7 } from 'uuid';
import { supabase } from '@src/lib/server/db';
import { DEMO_OTP } from '$lib/demo/constants';

// Mock isDemoMode to be true for these tests
vi.mock('@src/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@src/lib/utils')>();
  return {
    ...actual,
    isDemoMode: true
  };
});

// Dynamically import endpoints AFTER the mock is set up
const { POST: loginPOST } = await import('@src/routes/driver/login/+server');
const { POST: verifyOtpPOST } = await import('@src/routes/driver/verify-otp/+server');
const { POST: connectAccountPOST } = await import(
  '@src/routes/api/driver/argyle/connect-account/+server'
);
const { POST: authVerifyOtpPOST } = await import('@src/routes/api/auth/verify-otp/+server');

// Generate unique test phone for each test run (format: 1XXX555XXXX)
const generateTestPhone = () =>
  `1${Math.floor(100 + Math.random() * 900)}555${Math.floor(1000 + Math.random() * 9000)}`;

describe('Demo Flow Integration Tests', () => {
  describe('POST /driver/login (demo mode)', () => {
    it('returns 200 without calling Supabase OTP', async () => {
      const phoneNumber = generateTestPhone();
      const signInWithOtpSpy = vi.spyOn(supabase.auth, 'signInWithOtp');

      const response = await loginPOST({
        request: {
          json: () => Promise.resolve({ phoneNumber })
        }
      } as any);

      expect(response.status).toBe(200);
      // In demo mode, signInWithOtp should NOT be called
      expect(signInWithOtpSpy).not.toHaveBeenCalled();

      signInWithOtpSpy.mockRestore();
    });

    it('returns 400 when phone number is missing', async () => {
      const response = await loginPOST({
        request: {
          json: () => Promise.resolve({})
        }
      } as any);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /driver/verify-otp (demo mode)', () => {
    const testPhone = generateTestPhone();
    let createdUserId: string | null = null;

    afterAll(async () => {
      // Clean up the demo user created during tests
      if (createdUserId) {
        try {
          await supabase.auth.admin.deleteUser(createdUserId);
        } catch {
          // User may already be deleted
        }
      }
    });

    it('creates a new demo user with correct email pattern and demoMode flag', async () => {
      const response = await verifyOtpPOST({
        request: {
          json: () => Promise.resolve({ phone: testPhone, token: DEMO_OTP })
        }
      } as any);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.session).toBeDefined();
      expect(body.demoMode).toBe(true);

      createdUserId = body.user.id;

      // Verify the user email matches the expected pattern
      expect(body.user.email).toBe(`${testPhone}@demo.system.local`);

      // Verify the profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', createdUserId)
        .single();
      expect(profile).toBeDefined();
    });

    it('reuses existing demo user on subsequent login (idempotent)', async () => {
      // Skip if no user was created in the previous test
      if (!createdUserId) {
        return;
      }

      const response = await verifyOtpPOST({
        request: {
          json: () => Promise.resolve({ phone: testPhone, token: DEMO_OTP })
        }
      } as any);

      expect(response.status).toBe(200);

      const body = await response.json();
      // Should return the same user ID
      expect(body.user.id).toBe(createdUserId);
    });

    it('returns 403 with clear message for incorrect OTP in demo mode', async () => {
      const newPhone = generateTestPhone();

      const response = await verifyOtpPOST({
        request: {
          json: () => Promise.resolve({ phone: newPhone, token: '123456' })
        }
      } as any);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.message).toContain('555555');
    });

    it('returns 400 when phone is missing', async () => {
      const response = await verifyOtpPOST({
        request: {
          json: () => Promise.resolve({ token: DEMO_OTP })
        }
      } as any);

      expect(response.status).toBe(400);
    });

    it('returns 400 when token is missing', async () => {
      const response = await verifyOtpPOST({
        request: {
          json: () => Promise.resolve({ phone: testPhone })
        }
      } as any);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/driver/argyle/connect-account (demo mode)', () => {
    const testPhone = generateTestPhone();
    let userId: string | null = null;
    let session: any = null;
    const accountId = uuidv7(); // Must be valid UUID for database
    const argyleUserId = uuidv7(); // Must be valid UUID for database

    afterAll(async () => {
      // Clean up: delete activities, account, and user
      if (userId) {
        try {
          await supabase.from('argyle_driver_activities').delete().eq('user', userId);
          await supabase.from('argyle_accounts').delete().eq('user_id', userId);
          await supabase.auth.admin.deleteUser(userId);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('upserts argyle account and inserts demo activities from the Argyle sandbox snapshot', async () => {
      // Create a demo user first
      const loginResponse = await verifyOtpPOST({
        request: {
          json: () => Promise.resolve({ phone: testPhone, token: DEMO_OTP })
        }
      } as any);

      expect(loginResponse.status).toBe(200);
      const loginBody = await loginResponse.json();
      userId = loginBody.user.id;
      session = loginBody.session;

      // Update profile with argyle_user
      await supabase.from('profiles').update({ argyle_user: argyleUserId }).eq('user_id', userId);

      // Now call connect-account endpoint
      const response = await connectAccountPOST({
        locals: {
          safeGetSession: async () => ({ session, user: { id: userId } })
        },
        request: {
          json: () => Promise.resolve({ accountId, argyleUserId })
        }
      } as any);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);

      // Verify account was created
      const { data: account } = await supabase
        .from('argyle_accounts')
        .select('*')
        .eq('argyle_account', accountId)
        .single();

      expect(account).toBeDefined();
      expect(account?.argyle_user).toBe(argyleUserId);
      expect(account?.user_id).toBe(userId);

      const { count } = await supabase
        .from('argyle_driver_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user', userId);

      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(200);
    });

    it('connects when driver has a demo-org primary affiliation without organization_argyle_configs', async () => {
      const phone = generateTestPhone();
      const loginResponse = await verifyOtpPOST({
        request: {
          json: () => Promise.resolve({ phone, token: DEMO_OTP })
        }
      } as any);
      expect(loginResponse.status).toBe(200);
      const { user } = await loginResponse.json();
      const demoArgyleUserId = uuidv7();
      const demoAccountId = uuidv7();

      const { data: org } = await supabase
        .from('affiliate_organizations')
        .select('id')
        .eq('key', 'aass')
        .maybeSingle();

      if (!org) {
        console.warn('Skipping: demo org aass not in DB — run pnpm seed:demo-organizers first');
        return;
      }

      await supabase
        .from('profiles')
        .update({ argyle_user: demoArgyleUserId })
        .eq('user_id', user.id);
      await supabase.from('driver_affiliate_organization_affiliations').insert({
        user_id: user.id,
        affiliate_organization_id: org.id,
        is_primary: true
      });

      const response = await connectAccountPOST({
        locals: {
          safeGetSession: async () => ({ session: null, user: { id: user.id } })
        },
        request: {
          json: () =>
            Promise.resolve({
              accountId: demoAccountId,
              argyleUserId: demoArgyleUserId,
              orgKey: 'aass'
            })
        }
      } as any);

      expect(response.status).toBe(200);

      try {
        await supabase.from('argyle_driver_activities').delete().eq('user', user.id);
        await supabase.from('argyle_accounts').delete().eq('user_id', user.id);
        await supabase
          .from('driver_affiliate_organization_affiliations')
          .delete()
          .eq('user_id', user.id);
        await supabase.auth.admin.deleteUser(user.id);
      } catch {
        // Ignore cleanup errors
      }
    });

    it('creates activities with correct fields', async () => {
      if (!userId) {
        return; // Skip if no user was created
      }

      const { data: activities } = await supabase
        .from('argyle_driver_activities')
        .select('*')
        .eq('user', userId)
        .limit(5);

      expect(activities).toBeDefined();
      expect(activities!.length).toBeGreaterThan(0);

      activities!.forEach((activity) => {
        // Real Argyle sandbox data: employer is "Uber Driver", type is rideshare,
        // status is either "completed" or "cancelled".
        expect(activity.employer).toBe('Uber Driver');
        expect(activity.type).toBe('rideshare');
        expect(['completed', 'cancelled']).toContain(activity.status);
        expect(activity.account).toBe(accountId);
      });
    });

    it('returns 401 when not authenticated', async () => {
      const response = await connectAccountPOST({
        locals: {
          safeGetSession: async () => ({ session: null, user: null })
        },
        request: {
          json: () => Promise.resolve({ accountId: 'test', argyleUserId: 'test' })
        }
      } as any);

      expect(response.status).toBe(401);
    });

    it('returns 400 when accountId is missing', async () => {
      const response = await connectAccountPOST({
        locals: {
          safeGetSession: async () => ({ session, user: { id: userId || 'test' } })
        },
        request: {
          json: () => Promise.resolve({ argyleUserId })
        }
      } as any);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/verify-otp (demo mode)', () => {
    const testPhone = generateTestPhone();
    let userId: string | null = null;
    let session: any = null;
    let user: any = null;

    afterAll(async () => {
      if (userId) {
        try {
          await supabase.auth.admin.deleteUser(userId);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('returns current session when demo OTP is provided with active session', async () => {
      // Create a demo user first
      const loginResponse = await verifyOtpPOST({
        request: {
          json: () => Promise.resolve({ phone: testPhone, token: DEMO_OTP })
        }
      } as any);

      expect(loginResponse.status).toBe(200);
      const body = await loginResponse.json();
      userId = body.user.id;
      session = body.session;
      user = body.user;

      // Update profile with phone
      await supabase.from('profiles').update({ phone: testPhone }).eq('user_id', userId);

      // Now test the auth/verify-otp endpoint
      const response = await authVerifyOtpPOST({
        locals: {
          safeGetSession: async () => ({ session, user })
        },
        request: {
          clone: () => ({
            json: () => Promise.resolve({ phone: testPhone, token: DEMO_OTP })
          })
        }
      } as any);

      expect(response.status).toBe(200);

      const authBody = await response.json();
      expect(authBody.user).toBeDefined();
      expect(authBody.session).toBeDefined();
    });

    it('accepts userId instead of phone', async () => {
      if (!userId || !session || !user) {
        return; // Skip if no user was created
      }

      const response = await authVerifyOtpPOST({
        locals: {
          safeGetSession: async () => ({ session, user })
        },
        request: {
          clone: () => ({
            json: () => Promise.resolve({ userId, token: DEMO_OTP })
          })
        }
      } as any);

      expect(response.status).toBe(200);
    });

    it('returns 401 when no session exists in demo mode', async () => {
      const response = await authVerifyOtpPOST({
        locals: {
          safeGetSession: async () => ({ session: null, user: null })
        },
        request: {
          clone: () => ({
            json: () => Promise.resolve({ phone: testPhone, token: DEMO_OTP })
          })
        }
      } as any);

      expect(response.status).toBe(401);
    });

    it('returns 400 when token is missing', async () => {
      const response = await authVerifyOtpPOST({
        locals: {
          safeGetSession: async () => ({ session: session || {}, user: user || {} })
        },
        request: {
          clone: () => ({
            json: () => Promise.resolve({ phone: testPhone })
          })
        }
      } as any);

      expect(response.status).toBe(400);
    });
  });
});
