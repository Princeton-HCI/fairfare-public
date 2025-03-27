import path from 'path';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    pool: 'forks',
    maxConcurrency: 1,
    deps: {
      inline: ['moment']
    },
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./setupTests.ts']
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
});
