/**
 * This is a template utility script for creating organizer users.
 *
 * This should be used as a template. Copy and paste this and update the
 * phone numbers and organization key.
 *
 * Run with
 * node --loader ts-node/esm data-scripts/createOrganizerUsersTemplate.ts
 */
import createOrganizerUser from './createOrganizerUser.js';

await createOrganizerUser('du', '13034445555');
await createOrganizerUser('du', '12023334444');
