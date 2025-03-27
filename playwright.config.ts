import { defineConfig } from '@playwright/test';

import dotenv from 'dotenv';
// import path from 'path';

// Read from default ".env" file.
dotenv.config();

// Alternatively, read from "../my.env" file.
// dotenv.config({ path: path.resolve(__dirname, '..', 'my.env') });

export default defineConfig({
  webServer: {
    command: 'pnpm run build && pnpm run preview',
    port: 4173,
    reuseExistingServer: true
  },
  reporter: [['html'], ['dot']],
  projects: [
    {
      name: 'two users',
      retries: 0,
      use: {
        baseURL: 'http://localhost:4173',
        // we need clipboard permissions to copy QR code link
        ignoreHTTPSErrors: true,
        video: 'on-first-retry',
        permissions: ['clipboard-write', 'clipboard-read', 'camera'],
        browserName: 'chromium',
        // make this mobile-sized
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
  retries: 0,
  testDir: 'tests'
});
