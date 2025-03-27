import { error } from '@sveltejs/kit';

export async function load() {
  // check if this is development or not, if false then return 404
  // if true, then render the page
  if (process.env.NODE_ENV === 'production') {
    return error(404);
  }

  return {};
}
