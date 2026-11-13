import type { RequestEvent } from './$types';
import { supabase } from '@src/lib/server/db';
import { hasCapability } from '@src/lib/rbac';
import { loadAuthContext } from '@src/lib/server/rbac';

/**
 * Admin login: email + password. The authenticated user must hold the
 * `platform:view_admin_dashboard` permission (see `src/lib/roles.config.ts`).
 * Returns a session the client sets via supabase.auth.setSession.
 */
export const POST = async (event: RequestEvent) => {
  const { email, password } = await event.request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ message: 'Email and password are required' }), {
      status: 400
    });
  }

  const {
    data: { user, session },
    error
  } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password });

  if (error || !user || !session) {
    return new Response(JSON.stringify({ message: 'Invalid email or password' }), {
      status: 401
    });
  }

  const roles = await loadAuthContext(supabase, user.id);
  if (!hasCapability(roles, 'platform:view_admin_dashboard')) {
    return new Response(JSON.stringify({ message: 'Invalid email or password' }), {
      status: 403
    });
  }

  return new Response(JSON.stringify({ user, session }), { status: 200 });
};
