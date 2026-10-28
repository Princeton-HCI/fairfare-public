import { error } from '@sveltejs/kit';

export async function load({ url }) {
  // check if this is in prodution or not, if true then return 404
  // if false, render the page
  const PRODUCTION_HOST = 'getsystem.org';
  if (PRODUCTION_HOST.includes(url.host)) {
    return error(404);
  } else {
    return {};
  }
}
