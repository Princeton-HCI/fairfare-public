/**
 * Run with
 * node --loader ts-node/esm data-scripts/seedDatabase.ts
 */
import makeOrganizersSeeds from './makeOrganizersSeeds.js';
try {
  await makeOrganizersSeeds();
} catch (error) {
  console.error(error);
}
