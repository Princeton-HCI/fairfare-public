/**
 * This file exists to mock the env vars for vitest.
 */
import { config } from 'dotenv';

config(); // Load env vars

const TEST_SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TEST_SUPABASE_DEFAULT_PASSWORD = process.env.SUPABASE_DEFAULT_PASSWORD;
const TEST_INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

/**
 * Explicitly mock the env vars
 */

const VITE_TWILIO_TOKEN = process.env.VITE_TWILIO_TOKEN;
const VITE_TWILIO_NUMBER = 'test VITE_TWILIO_NUMBER';
const SUPABASE_DEFAULT_PASSWORD = TEST_SUPABASE_DEFAULT_PASSWORD;
const SUPABASE_SERVICE_KEY = TEST_SUPABASE_SERVICE_KEY;
const ARGYLE_WEBHOOK_SECRET = process.env.ARGYLE_WEBHOOK_SECRET || 'test-webhook-secret';
const INTERNAL_API_SECRET = TEST_INTERNAL_API_SECRET;
const foo = 'bar';

export {
  VITE_TWILIO_TOKEN,
  VITE_TWILIO_NUMBER,
  SUPABASE_DEFAULT_PASSWORD,
  SUPABASE_SERVICE_KEY,
  ARGYLE_WEBHOOK_SECRET,
  INTERNAL_API_SECRET,
  foo
};
