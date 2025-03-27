import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = {
  plugins: [
    sentrySvelteKit({
      sourceMapsUploadOptions: {
        org: 'the-organization',
        project: 'Sample System'
      }
    }),
    sveltekit()
  ],
  server: {
    allowedHosts: [
      'getsystem.org',
      'sample.ngrok.io',
      'sample2.ngrok.io',
      'sample3.ngrok.io',
      'staging.getsystem.org'
    ]
  }
};

export default config;
