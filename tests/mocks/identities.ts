import identityFixture from '../fixtures/argyle/identity-by-id.json' with { type: 'json' };
import type { ArgyleIdentity } from '@src/lib/types';

/**
 * The shape comes from a real sandbox response (tests/fixtures/argyle), recorded
 * by `pnpm run snapshot:argyle-stub` — the same fixtures the Playwright stub
 * replays, so the unit suite and the e2e suite mock Argyle with one set of
 * shapes rather than two that drift apart.
 *
 * It was hand-written before, and had drifted: the recorded identity carries
 * `original_hire_date`, `employment`, `platform_ids` and `base_pay`, none of
 * which the hand-written version had. Secrets are redacted at record time (the
 * `ssn` here reads 000-00-0000).
 */
const mockedArgyleIdentityResponse = identityFixture.body as unknown as ArgyleIdentity;

export const generateMockedArgyleIdentityResponse = (overrides: Partial<ArgyleIdentity> = {}) => {
  return {
    ...mockedArgyleIdentityResponse,
    ...overrides
  };
};
