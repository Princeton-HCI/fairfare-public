/**
 * This file exists to mock the env vars for vitest.
 */
import { config } from 'dotenv';

config(); // Load env vars

const TEST_SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TEST_SUPABASE_DEFAULT_PASSWORD = process.env.SUPABASE_DEFAULT_PASSWORD;

/**
 * Explicitly mock the env vars
 */

const VITE_TWILIO_TOKEN = process.env.VITE_TWILIO_TOKEN;
const VITE_TWILIO_NUMBER = 'test VITE_TWILIO_NUMBER';
const SUPABASE_DEFAULT_PASSWORD = TEST_SUPABASE_DEFAULT_PASSWORD;
const SUPABASE_SERVICE_KEY = TEST_SUPABASE_SERVICE_KEY;
const foo = 'bar';

export {
  VITE_TWILIO_TOKEN,
  VITE_TWILIO_NUMBER,
  SUPABASE_DEFAULT_PASSWORD,
  SUPABASE_SERVICE_KEY,
  foo
};
