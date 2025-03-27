/**
 * This is a template utility script for creating organizer users.
 *
 * This should be used as a template. Copy and paste this and update the
 * phone numbers and organization key.
 *
 * Run with
 * node --loader ts-node/esm data-migrations/createOrganizerUsersTemplate.ts
 * node v18.20.4
 */
import createOrganizerUser from './createOrganizerUser.js';

await createOrganizerUser('lpc', '13034445555');
await createOrganizerUser('lpc', '12023334444');
