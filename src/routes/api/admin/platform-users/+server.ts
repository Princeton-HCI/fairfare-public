import { json, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { requireAdminApi, type AdminContext } from '@src/lib/server/adminAuth';
import { requireCapability } from '@src/lib/server/rbac';
import { logAdminAction } from '@src/lib/server/adminAudit';
import {
  HttpError,
  handleApiError,
  postgresHttpError,
  readJsonBody,
  stringField
} from '@src/lib/server/apiErrors';
import { findAuthUserIdByEmail } from '@src/lib/databaseHelpers';
import {
  capabilityForPlatformRole,
  parseAssignablePlatformRole,
  type AssignablePlatformRole
} from '@src/lib/rbac';

/**
 * Platform users: the staff whose access comes from `user_roles.role` rather
 * than an organization membership — researchers and admins (see
 * `src/lib/roles.config.ts`). Both sign in at `/admin/login` with an email and
 * a password, so provisioning is by email: the account is created here with
 * `email_confirm`, which is what keeps this flow free of invitation or
 * confirmation emails.
 *
 * Three verbs, deliberately not two:
 *
 * - `POST` provisions credentials (create an account, or reset the password of
 *   one that already holds the role being asked for).
 * - `PATCH` changes an existing user's role and never touches credentials.
 * - `DELETE` revokes the staff role, falling back to driver/organizer.
 *
 * Splitting POST from PATCH is what makes promotion safe. A single "add by
 * email" that promoted whoever owned the address would, on a typo, both reset a
 * real person's password and hand them the role — and `admin` is every
 * capability in the product. Promotion now goes through a userId the admin
 * picked off the list, with the account's identity in front of them.
 *
 * Granting or revoking `admin` requires `platform:manage_admins`, checked
 * against both the old and the new role so a demotion is gated as tightly as
 * the promotion. Losing the last admin is refused by the `guard_last_admin`
 * trigger, which the service-role client cannot bypass.
 */

/** Supabase's own floor is 6; we ask for a little more. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * The capability guard for a write. Every caller needs
 * `platform:manage_users`; anything that touches the `admin` role — assigning
 * it, or replacing it with something else — additionally needs
 * `platform:manage_admins`, so only admins can add or remove other admins.
 */
function requireRoleCapabilities(admin: AdminContext, ...roles: (string | null | undefined)[]) {
  for (const role of roles) {
    requireCapability(admin.roles, capabilityForPlatformRole(role));
  }
}

/**
 * The platform role stored for a user, or `null` when they have no row. Reads
 * fail closed: treating a lookup failure as "no role" would let the writes
 * below overwrite an admin's account under the researcher capability.
 */
async function currentPlatformRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Failed to look up current platform role:', error);
    throw new HttpError('Failed to look up current role', 500);
  }
  return data?.role ?? null;
}

async function ensureProfileEmail(userId: string, email: string): Promise<void> {
  // The auth trigger writes the email into the profile inside the `auth.users`
  // insert, so the row already exists here. Write it ourselves anyway: the
  // admin list reads `profiles.email`, and the trigger does not run for a user
  // that predates it.
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ email })
    .eq('user_id', userId)
    .select('user_id');

  // A failed update is not "no row to update": falling through would attempt an
  // insert that the existing row's primary key rejects, reporting a confusing
  // "could not create the profile" instead of what actually went wrong.
  if (updateError) {
    console.error('Failed to update profile email for platform user:', updateError);
    throw new HttpError('Failed to update the profile for this account', 500);
  }

  if ((updated ?? []).length > 0) return;

  const { error } = await supabase.from('profiles').insert({ user_id: userId, email });
  if (error) {
    console.error('Failed to create profile for platform user:', error);
    throw new HttpError('Failed to create the profile for this account', 500);
  }
}

/** Write the platform role, translating the guard triggers' P0001 into a 409. */
async function setPlatformRole(userId: string, role: AssignablePlatformRole | string) {
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' });
  if (error) {
    console.error('Failed to set platform role:', error);
    throw postgresHttpError(error, 'Failed to set the role for this account');
  }
}

/**
 * Provision a platform user by email: create the account with the password the
 * admin typed, or reset the password of an account that already holds the
 * requested role.
 *
 * An email belonging to an account with a *different* role is refused with 409
 * before anything is written — it is either a typo'd worker or organizer whose
 * account must not be taken over, or a real staff member whose role should
 * change through `PATCH`, where no credentials move.
 */
export const POST = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_users');

  try {
    const body = await readJsonBody(request);
    const email = stringField(body, 'email').toLowerCase();
    const password = typeof body?.password === 'string' ? body.password : '';
    const role = parseAssignablePlatformRole(body?.role ?? 'researcher');

    if (!role) throw new HttpError('Pick a role of researcher or admin', 400);
    requireRoleCapabilities(admin, role);

    if (!email) throw new HttpError('email is required', 400);
    if (!email.includes('@')) throw new HttpError('Enter a valid email address', 400);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new HttpError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
    }

    let userId = await findAuthUserIdByEmail(supabase, email);
    const created = userId === null;

    // Every guard on the existing account runs *before* the first write. A
    // password reset that happens ahead of the checks below cannot be undone by
    // rejecting the request afterwards: the account is already locked out, and
    // the caller is told nothing happened.
    if (userId) {
      const existingRole = await currentPlatformRole(userId);

      // Only an account that already holds the requested role may be reset from
      // here. An account with a *different* staff role changes through PATCH,
      // where no credentials move. An account with no platform role at all is
      // refused too: workers never get a `user_roles` row in app code, so "no
      // role" is indistinguishable from a real worker whose address was
      // mistyped, and promoting them would both take over their account and
      // hand it the role.
      if (existingRole !== role) {
        // The non-staff branch must not point at `seed:admins` for a researcher
        // request: that script only ever writes `admin`, so following it would
        // hand the account every capability in the product instead of the role
        // the admin actually asked for.
        throw new HttpError(
          existingRole === 'researcher' || existingRole === 'admin'
            ? 'This email already belongs to another staff account. Change their role from the list instead.'
            : role === 'admin'
              ? 'This email already belongs to a System account that is not staff. Promote it with seed:admins if that is really intended.'
              : 'This email already belongs to a System account that is not staff. Accounts that are not staff cannot be promoted from here.',
          409
        );
      }

      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true
      });
      if (error) {
        console.error('Failed to update platform user password:', error);
        throw new HttpError('Failed to set the password for this account', 500);
      }
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (error || !data.user) {
        console.error('Failed to create platform user:', error);
        throw new HttpError('Failed to create a user for this email address', 500);
      }
      userId = data.user.id;
    }

    await ensureProfileEmail(userId, email);
    await setPlatformRole(userId, role);

    // The password is never logged, here or in the audit trail.
    await logAdminAction(admin, {
      action: 'platform_user.add',
      targetType: 'user',
      targetId: userId,
      metadata: { email, role, created }
    });

    return json({ success: true, userId, role, created });
  } catch (error) {
    return handleApiError(error, 'Failed to add platform user');
  }
};

/**
 * Change an existing user's platform role. Credentials are never touched here,
 * so promoting someone cannot lock them out of the account being promoted.
 */
export const PATCH = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_users');

  try {
    const body = await readJsonBody(request);
    const userId = stringField(body, 'userId');
    const role = parseAssignablePlatformRole(body?.role);

    if (!userId) throw new HttpError('userId is required', 400);
    if (!role) throw new HttpError('Pick a role of researcher or admin', 400);

    // Changing your own role is refused rather than guarded: an admin demoting
    // themselves is almost always a misclick, and the database cannot catch it
    // (under service_role there is no caller identity to compare against).
    if (userId === admin.user.id) {
      throw new HttpError('You cannot change your own role', 409);
    }

    const existingRole = await currentPlatformRole(userId);
    // Only someone who is already staff can be moved between staff roles.
    // Without this the endpoint would be a second door to the escalation POST
    // refuses: a userId that belongs to a worker, promoted straight to admin.
    // Making a driver or organizer an admin is `pnpm seed:admins`' job.
    if (existingRole !== 'researcher' && existingRole !== 'admin') {
      throw new HttpError('This user is not a researcher or an admin', 409);
    }
    requireRoleCapabilities(admin, existingRole, role);

    if (existingRole === role) return json({ success: true, userId, role, changed: false });

    await setPlatformRole(userId, role);

    await logAdminAction(admin, {
      action: 'platform_user.role_changed',
      targetType: 'user',
      targetId: userId,
      metadata: { from: existingRole, to: role }
    });

    return json({ success: true, userId, role, changed: true });
  } catch (error) {
    return handleApiError(error, 'Failed to change the role for this user');
  }
};

/** Remove a user's staff role, leaving the account and its password in place. */
export const DELETE = async ({ locals, url }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_users');

  try {
    const userId = url.searchParams.get('userId');
    if (!userId) throw new HttpError('userId is required', 400);

    if (userId === admin.user.id) {
      throw new HttpError('You cannot remove your own role', 409);
    }

    const existingRole = await currentPlatformRole(userId);
    if (existingRole !== 'researcher' && existingRole !== 'admin') {
      throw new HttpError('This user is not a researcher or an admin', 409);
    }
    requireRoleCapabilities(admin, existingRole);

    // `user_roles` holds one row per user, so fall back to the role the rest of
    // the app expects: organizer if they belong to an organization, else driver.
    // A failed count is not "no memberships": it would silently write `driver`
    // over an organizer's row, so fail closed and leave the staff role in place
    // for the caller to retry.
    const { count: membershipCount, error: membershipError } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (membershipError) {
      console.error('Failed to count organization memberships for platform user:', membershipError);
      throw new HttpError('Failed to work out which role to fall back to', 500);
    }
    const fallbackRole = membershipCount && membershipCount > 0 ? 'organizer' : 'driver';

    await setPlatformRole(userId, fallbackRole);

    await logAdminAction(admin, {
      action: 'platform_user.remove',
      targetType: 'user',
      targetId: userId,
      metadata: { from: existingRole, fallbackRole }
    });

    return json({ success: true, role: fallbackRole });
  } catch (error) {
    return handleApiError(error, 'Failed to remove this platform user');
  }
};
