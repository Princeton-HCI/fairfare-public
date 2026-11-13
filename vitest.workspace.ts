import { defineWorkspace, mergeConfig, configDefaults } from 'vitest/config';
import { sharedConfig } from './vitest.shared';

/**
 * Two projects, split by what a test needs to run:
 *
 *   unit — `*.spec.ts`. No database, no Docker, runs in parallel, ~2 seconds.
 *          This is the loop to stay in while writing code.
 *   db   — `*.db.spec.ts`. Needs `supabase start`. Runs in parallel too, against
 *          one shared local database.
 *
 * `pnpm test:unit` / `pnpm test:db` run one; `pnpm test` runs both.
 *
 * The db project can run its files at the same time because no fixture is
 * shared: users, phone numbers, organizations and Argyle identifiers are all
 * generated per run and torn down by whoever created them (see
 * tests/utils/testUser.ts). Global worker tests restrict work selection with
 * tests/utils/scopeDatabaseReads.ts. Keep it that way when adding a spec here —
 * a `.delete()` without an `.eq()`, or an assertion about every row in a table,
 * puts this project back to running one file at a time.
 */
export default defineWorkspace([
  mergeConfig(sharedConfig, {
    test: {
      name: 'unit',
      setupFiles: ['./tests/setupUnitTests.ts'],
      include: ['src/**/*.spec.ts'],
      exclude: [...configDefaults.exclude, '**/*.db.spec.ts']
    }
  }),
  mergeConfig(sharedConfig, {
    test: {
      name: 'db',
      include: ['src/**/*.db.spec.ts'],
      pool: 'forks'
    }
  })
]);
