import { defineConfig } from '@playwright/test';
import { ARGYLE_STUB_PORT, ARGYLE_STUB_URL } from './tests/argyleStub';

/**
 * Argyle is stubbed locally by default (tests/argyleStub.ts). ARGYLE_LIVE=1
 * points the app at the real sandbox instead, for the occasional check against
 * Argyle's actual responses.
 */
const useLiveArgyle = process.env.ARGYLE_LIVE === '1';
const argyleUrl = useLiveArgyle
  ? (process.env.PUB_ARGYLE_LINK_URL ?? 'https://api-sandbox.argyle.com')
  : ARGYLE_STUB_URL;

// The specs and the helpers in tests/utils read this directly; the app reads it
// through `$env/static/public`, which Vite inlines at build time, so it also has
// to be set for the build below.
process.env.PUB_ARGYLE_LINK_URL = argyleUrl;

const appPort = 4173;

export default defineConfig({
  // Seeds shared fixtures once per process, before any worker starts.
  globalSetup: './tests/globalSetup.ts',
  webServer: [
    ...(useLiveArgyle
      ? []
      : [
          {
            command: 'npx tsx tests/runArgyleStub.ts',
            port: ARGYLE_STUB_PORT,
            reuseExistingServer: !process.env.CI,
            timeout: 30 * 1000
          }
        ]),
    {
      // CI builds the app in its own step (and shares it between shards), so
      // building again here would compile the same commit twice per shard.
      command: process.env.CI ? 'pnpm run preview' : 'pnpm run build && pnpm run preview',
      port: appPort,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: { ...process.env, PUB_ARGYLE_LINK_URL: argyleUrl }
    }
  ],
  reporter: process.env.CI ? [['html'], ['dot'], ['github']] : [['html'], ['dot']],
  projects: [
    {
      name: 'main',
      use: {
        baseURL: `http://localhost:${appPort}`,
        ignoreHTTPSErrors: true,
        video: process.env.CI ? 'retain-on-failure' : 'on-first-retry', // Only keep videos on failure
        trace: process.env.CI ? 'on-first-retry' : 'off',
        screenshot: 'only-on-failure',
        permissions: ['clipboard-write', 'clipboard-read', 'camera'],
        browserName: 'chromium',
        viewport: {
          height: 667,
          width: 375
        }
      }
    }
  ],
  use: {
    permissions: ['clipboard-write', 'clipboard-read', 'camera']
  },
  retries: 0, // Always 0 retries to avoid letting flaky tests pass
  testDir: 'tests',
  workers: process.env.CI ? 2 : 1, // Fixed number instead of percentage
  timeout: 30000, // 30 seconds per test
  // Pages that load seeded report data are the slow ones; this is the ceiling
  // for a single `expect`, so specs do not each carry their own 90s literal.
  expect: { timeout: 15000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  updateSnapshots: 'missing',
  shard:
    process.env.CI && process.env.PLAYWRIGHT_SHARD
      ? {
          current: parseInt(process.env.PLAYWRIGHT_SHARD || '1'),
          total: parseInt(process.env.PLAYWRIGHT_TOTAL_SHARDS || '2')
        }
      : undefined
});
