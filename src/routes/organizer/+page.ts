import { redirect } from '@sveltejs/kit';

// Point to the login page so this doesn't 404
export function load() {
  redirect(302, '/organizer/login');
}
