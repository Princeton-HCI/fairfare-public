/**
 * This file exists to mock the env vars for vitest.
 */
import { config } from 'dotenv';

config(); // Load env vars

const TEST_PUB_VITE_SUPABASE_URL = process.env.PUB_VITE_SUPABASE_URL;
const TEST_PUB_VITE_SUPABASE_ANON_KEY = process.env.PUB_VITE_SUPABASE_ANON_KEY;
const TEST_PUB_SUPPORT_EMAIL = process.env.PUB_SUPPORT_EMAIL;

/**
 * Explicitly mock the env vars
 */

const PUB_VITE_TWILIO_SID = process.env.PUB_VITE_TWILIO_SID;
const PUB_ARGYLE_LINK_URL = 'http://argyletestingurl.test';
const PUB_VITE_SUPABASE_URL = TEST_PUB_VITE_SUPABASE_URL;
const PUB_VITE_SUPABASE_ANON_KEY = TEST_PUB_VITE_SUPABASE_ANON_KEY;
const PUB_SUPPORT_EMAIL = TEST_PUB_SUPPORT_EMAIL;

export {
  PUB_VITE_TWILIO_SID,
  PUB_ARGYLE_LINK_URL,
  PUB_VITE_SUPABASE_URL,
  PUB_VITE_SUPABASE_ANON_KEY,
  PUB_SUPPORT_EMAIL
};
