/**
 * Run with
 * node --loader ts-node/esm data-migrations/seedDatabase.ts
 */
import makeOrganizersSeeds from './makeOrganizersSeeds.js';
try {
  await makeOrganizersSeeds();
} catch (error) {
  console.error(error);
}
