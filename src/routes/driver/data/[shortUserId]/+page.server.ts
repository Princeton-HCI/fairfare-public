import type { PageServerLoad } from './$types';
import { wrapLoadWithSentry } from '@sentry/sveltekit';

import short from 'short-uuid';
import { getRecentSixMonthsPublicTakeRateInfoFromShortUserId } from '@src/lib/gigCalculations';

export const load: PageServerLoad = wrapLoadWithSentry(
  async ({ locals: { safeGetSession }, params }) => {
    const translator = short();
    const shortUserId = params.shortUserId;
    const userId = translator.toUUID(shortUserId);

    const { session } = await safeGetSession();

    const sameUser = session?.user?.id === userId;

    // We want to return ONLY THE CRITICAL INFO so that we don't expose all
    // the gigs to anonymous users
    try {
      return {
        session,
        ...(await getRecentSixMonthsPublicTakeRateInfoFromShortUserId(shortUserId)),
        sameUser,
        hasError: false
      };
    } catch (error) {
      let errorI18nKey = 'UnknownError';
      // get the error.name and use it as the key for i18n
      if (error instanceof Error) errorI18nKey = error.name;
      console.error('Error in driver/data/[shortUserId]/+page.server.ts', error);

      return {
        session,
        hasError: true,
        errorI18nKey
      };
    }
  }
);
