import path from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { UserWorkspaceConfig } from 'vitest/config';

/**
 * Configuration both test projects share. See vitest.workspace.ts for the split
 * between them.
 */
export const sharedConfig: UserWorkspaceConfig = {
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setupTests.ts'],
    server: {
      deps: {
        inline: ['moment']
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      reportsDirectory: './coverage',
      // Measure the code the suite is meant to cover: app logic, not generated
      // types, fixtures or the test scaffolding itself.
      include: ['src/**/*.{ts,svelte}'],
      exclude: ['src/**/*.spec.ts', 'src/lib/schema.ts', 'src/**/*.d.ts', 'src/app.html']
      // No thresholds yet: run `pnpm test:coverage` to see where the suite
      // actually stands before choosing a number worth failing a build over.
    }
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@components': path.resolve(__dirname, './src/lib/components'),
      '@routes': path.resolve(__dirname, './src/routes'),
      $lib: path.resolve(__dirname, './src/lib'),
      $env: path.resolve(__dirname, './tests/env')
    }
  }
};
