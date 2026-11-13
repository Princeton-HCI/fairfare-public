import * as Sentry from '@sentry/sveltekit';
import '@src/lib/client/db';

const environment = window.location.origin.includes('://getsystem.org')
  ? 'production'
  : 'development';

Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  environment,
  enabled: environment === 'production',
  ignoreErrors: [
    'NetworkError',
    'Failed to fetch',
    'Load failed',
    'AbortError',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications'
  ],
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//],
  beforeSend(event) {
    return event.exception ? event : null;
  }
});

export const handleError = Sentry.handleErrorWithSentry();
