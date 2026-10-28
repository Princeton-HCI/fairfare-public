/**
 * Server-only demo mode constants.
 *
 * These values are used exclusively in server-side code (e.g. OTP verification,
 * user creation) and must NOT be imported from client-side code.
 * For client-safe demo constants, use `$lib/demo/constants`.
 */

// Re-export DEMO_OTP from the single source of truth (client-safe module)
// so server code can import everything from one place.
export { DEMO_OTP } from '$lib/demo/constants';

/** Password prefix used when creating demo users in Supabase */
export const DEMO_PASSWORD_PREFIX = 'demo-system-';
