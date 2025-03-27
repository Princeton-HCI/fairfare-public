import type { LayoutServerLoad } from '../$types';
import { redirect } from '@sveltejs/kit';
import { wrapLoadWithSentry } from '@sentry/sveltekit';
import profileIsSynced from '@src/lib/client/profileIsSynced';

export const load: LayoutServerLoad = wrapLoadWithSentry(async ({ locals: { safeGetSession } }) => {
  const { profile } = await safeGetSession();

  if (profileIsSynced(profile)) {
    throw redirect(302, '/driver/done');
  } else {
    throw redirect(302, '/driver/landing');
  }
});
