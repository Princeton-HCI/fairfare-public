import * as Sentry from '@sentry/sveltekit';
import '@src/lib/client/db';

const getEnvironment = () => {
  const origin = window.location.origin;

  if (origin.includes('://getsystem.org')) {
    return 'production';
  }
  if (origin.includes('://localhost')) {
    return 'development';
  }
  if (origin.includes('://staging.getsystem.org')) {
    return 'staging';
  }
  if (origin.endsWith('.netlify.app')) {
    return 'deploy-preview';
  }
  return 'unknown';
};

// If you don't want to use Session Replay, remove the `Replay` integration,
// `replaysSessionSampleRate` and `replaysOnErrorSampleRate` options.
Sentry.init({
  // CONTEXT is from Netlify's build metadata: https://docs.netlify.com/configure-builds/environment-variables/#build-metadata
  // MODE is from Vite's build metadata: https://vitejs.dev/guide/env-and-mode.html#modes
  environment: getEnvironment(),
  dsn: 'https://3f41c01122e43d8dfa35db144809967c@o4506775983947776.ingest.us.sentry.io/4508320236437504',
  tracesSampleRate: 1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.replayIntegration()]
});

export const handleError = Sentry.handleErrorWithSentry();
