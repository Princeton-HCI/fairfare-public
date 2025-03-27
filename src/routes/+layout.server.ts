import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import type { LayoutServerLoad } from './$types';
import { supabase } from '@src/lib/server/db';
import { wrapLoadWithSentry } from '@sentry/sveltekit';

const cleanAcceptLanguageString = (acceptLanguage: string) => {
  // string comes in like es-ES,es;q=0.9
  // we only want 'es'
  return acceptLanguage.split(',')[0].split('-')[0];
};
export const load: LayoutServerLoad = wrapLoadWithSentry(
  async ({ locals: { safeGetSession }, cookies, request: { headers }, params: { slug } }) => {
    const { session, user, profile } = await safeGetSession();

    // FIXME: don't use user_metadata; swtich to profile
    const userPreferredLanguage = user?.user_metadata.preferred_language;

    // this gives us the browser's language setting
    const acceptLanguageString = headers.get('accept-language') || '';

    // if the user (a) exists and (b) has no preferred language,
    // we set it here based on the browser's language setting
    if (!userPreferredLanguage && user && session) {
      try {
        await updateProfileByUserId(supabase, user.id, {
          preferred_language: cleanAcceptLanguageString(acceptLanguageString)
        });
      } catch (error) {
        console.error('Error setting preferred language:', error);
      }
    }

    return {
      session,
      userPreferredLanguage,
      profile,
      slug: slug,
      user,
      cookies: cookies.getAll()
    };
  }
);
