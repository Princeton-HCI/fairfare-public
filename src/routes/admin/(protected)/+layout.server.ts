import { requireAdminPage } from '@src/lib/server/adminAuth';

/**
 * Guards the entire admin area. The login route lives outside this
 * `(protected)` group so it remains reachable without auth. Every nested
 * page's own `+page.server.ts` and every `/api/admin/*` endpoint still calls
 * `requireAdminPage` independently (API routes aren't children of this layout
 * and call `requireAdminApi` with the `platform:manage_*` permission they need).
 */
export async function load({ locals }) {
  await requireAdminPage(locals);
  return {};
}
