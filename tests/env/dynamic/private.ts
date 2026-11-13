/**
 * This file exists to mock the $env/dynamic/private module for vitest.
 * Unlike $env/static/private, dynamic/private exports an `env` object.
 */
import { config } from 'dotenv';

config(); // Load env vars

/**
 * Mock the env object that $env/dynamic/private exports
 */
export const env = {
  INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  SUPABASE_DEFAULT_PASSWORD: process.env.SUPABASE_DEFAULT_PASSWORD,
  VITE_TWILIO_TOKEN: process.env.VITE_TWILIO_TOKEN,
  VITE_TWILIO_NUMBER: 'test VITE_TWILIO_NUMBER',
  ARGYLE_WEBHOOK_SECRET: process.env.ARGYLE_WEBHOOK_SECRET || 'test-webhook-secret',
  ARGYLE_ENCRYPTION_KEY:
    process.env.ARGYLE_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL,
  EXPORT_STORAGE_BUCKET: process.env.EXPORT_STORAGE_BUCKET || 'exports'
} as Record<string, string | undefined>;
