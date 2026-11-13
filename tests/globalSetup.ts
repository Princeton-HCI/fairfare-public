/**
 * Runs once per `playwright test` process, before any worker starts.
 *
 * Shared fixtures belong here rather than in a spec's `beforeAll`, which runs
 * once per worker and therefore races itself under `fullyParallel`. Each CI
 * shard is its own process against its own Supabase instance, so seeding once
 * here covers every worker in that shard exactly once.
 *
 * Keep this cheap. Heavy, spec-specific data (for example the 5,000 activities
 * that tests/organizerPortal.spec.ts needs) stays in that spec, so a
 * shard that never runs those tests does not pay for them.
 */

import { seedRbacFixtures } from './seeds/rbacSeeds';

export default async function globalSetup() {
  await seedRbacFixtures();
}
