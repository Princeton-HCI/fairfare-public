import { error } from '@sveltejs/kit';

/**
 * The research aggregates page is retired: no role reaches it any more, so the
 * load throws 404 before `+page.svelte` renders and before any aggregate query
 * runs. The markup and `platform:view_cross_org_aggregates` are left in place so
 * the page can be switched back on by restoring the `requireAdminPage` guard.
 */
export async function load() {
  throw error(404, 'Not found');
}
