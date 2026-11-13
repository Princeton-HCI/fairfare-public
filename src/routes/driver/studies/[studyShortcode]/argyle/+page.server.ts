import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  const { studyShortcode } = params;

  // include the whole query string
  const queryString = url.searchParams.toString();

  const redirectTo = `/driver/studies/${studyShortcode}/start${queryString ? `?${queryString}` : ''}`;
  const redirectUrl = `/driver/login?redirect=${encodeURIComponent(redirectTo)}`;

  // Always redirect to login; if the user is already logged in, they will be redirected to the study
  throw redirect(302, redirectUrl);
};
