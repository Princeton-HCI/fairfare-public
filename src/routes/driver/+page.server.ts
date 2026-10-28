import type { LayoutServerLoad } from '../$types';
import { redirect, error } from '@sveltejs/kit';
import { wrapLoadWithSentry } from '@sentry/sveltekit';
import { supabase } from '@src/lib/server/db';

export const load: LayoutServerLoad = wrapLoadWithSentry(async ({ locals: { safeGetSession } }) => {
  const { user } = await safeGetSession();

  // if user is not logged in, redirect to landing page
  if (!user) {
    throw redirect(302, '/driver/landing');
  }

  // query for accounts added in the past day; just check if there are any
  const { count, error: accountCountError } = await supabase
    .from('argyle_accounts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString())
    .eq('user_id', user.id);

  if (accountCountError || count === null) {
    console.error('Error fetching accounts:', accountCountError);
    throw error(500, 'Error fetching accounts');
  }

  const hasAccountsAddedInThePastDay = count > 0;

  if (hasAccountsAddedInThePastDay) {
    throw redirect(302, '/driver/done');
  } else {
    throw redirect(302, '/driver/landing');
  }
});
