import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = {
  plugins: [
    sentrySvelteKit({
      sourceMapsUploadOptions: {
        org: 'the-organization',
        project: 'system'
      }
    }),
    sveltekit()
  ],
  server: {
    allowedHosts: ['getsystem.org', '.loca.lt', 'staging.getsystem.org']
  }
};

export default config;
