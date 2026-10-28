import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

/**
 * Validates the internal API key from the Authorization header.
 * Used to protect scheduled/internal endpoints from unauthorized access.
 *
 * @param request - The incoming request object
 * @throws 401 error if the Authorization header is missing or invalid
 */
export function validateInternalApiKey(request: Request): void {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    throw error(401, 'Unauthorized: Missing Authorization header');
  }

  if (!env.INTERNAL_API_SECRET || authHeader !== `Bearer ${env.INTERNAL_API_SECRET}`) {
    throw error(401, 'Unauthorized: Invalid API key');
  }
}
