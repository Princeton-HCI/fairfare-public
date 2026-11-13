/**
 * Client-safe demo mode constants and credentials.
 *
 * This file is importable from both client and server code.
 * It must NOT contain secrets like password prefixes.
 * For server-only constants, use `$lib/server/demo/constants`.
 */

/**
 * Fixed OTP code accepted in demo mode for System login.
 * Re-exported here because client components pre-fill the OTP input with this
 * value (it is shown to the user, not a secret).
 */
export const DEMO_OTP = '555555';

/** Base URL for the demo deployment */
export const DEMO_BASE_URL = 'https://demo.getsystem.org/';

/**
 * Argyle sandbox test user "Bob Jones" credentials.
 * From: https://docs.argyle.com/overview/sandbox-testing
 *
 * These are used to auto-fill the Argyle Link form in demo mode
 * and displayed in the credentials sidebar/modal.
 */
export const ARGYLE_SANDBOX_BOB = {
  email: 'test1@argyle.com',
  password: 'passgood',
  username: 'test_1',
  phone: '8009000010',
  phoneFormatted: '(800) 900-0010',
  fullPhone: '18009000010',
  verificationCode: '8081',
  driversLicense: 'D1230010',
  mfaCode: '8081',
  displayName: 'Bob Jones',
  avatarUrl:
    'https://res.cloudinary.com/argyle-media/image/upload/c_lfill,w_auto,g_auto,q_auto,dpr_auto,f_auto/bob-portrait.png'
} as const;

/** OTP code for Argyle sandbox (6 digits for Argyle's MFA) */
export const ARGYLE_SANDBOX_OTP = '808181';
