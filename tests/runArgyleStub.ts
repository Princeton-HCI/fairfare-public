/**
 * Entry point for the Argyle stub, started by Playwright as a second webServer.
 * See tests/argyleStub.ts for what it serves and why.
 */

import { startArgyleStub, ARGYLE_STUB_URL } from './argyleStub';

startArgyleStub().then(() => {
  console.log(`Argyle stub listening on ${ARGYLE_STUB_URL}`);
});
