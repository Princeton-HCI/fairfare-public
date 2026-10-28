import { json, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { requireAdminApi } from '@src/lib/server/adminAuth';
import { logAdminAction } from '@src/lib/server/adminAudit';
import {
  HttpError,
  handleApiError,
  postgresHttpError,
  readJsonBody,
  stringField
} from '@src/lib/server/apiErrors';
import { parseOrganizationRole } from '@src/lib/rbac';

/**
 * Organization memberships (user → organization, with an organization role).
 * Platform roles (researcher, admin) are managed on /api/admin/platform-users.
 */

/** Grant an organizer affiliation (user → organization). Idempotent. */
export const POST = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_users');

  try {
    const body = await readJsonBody(request);
    const userId = stringField(body, 'userId');
    const organizationId = stringField(body, 'organizationId');
    const role = parseOrganizationRole(body?.role) ?? 'organizer';
    if (!userId) throw new HttpError('userId is required', 400);
    if (!organizationId) throw new HttpError('organizationId is required', 400);

    const { error } = await supabase.from('organization_members').upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        role,
        created_by: admin.user.id
      },
      { onConflict: 'user_id, organization_id' }
    );

    if (error) {
      console.error('Error granting organizer affiliation:', error);
      throw postgresHttpError(error, 'Failed to grant affiliation');
    }

    await logAdminAction(admin, {
      action: 'organizer.affiliation_grant',
      targetType: 'organizer',
      targetId: organizationId,
      metadata: { userId, role }
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to grant affiliation');
  }
};

/** Change an organizer's organization role. */
export const PATCH = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_users');

  try {
    const body = await readJsonBody(request);
    const userId = stringField(body, 'userId');
    const organizationId = stringField(body, 'organizationId');
    const role = parseOrganizationRole(body?.role);
    if (!userId) throw new HttpError('userId is required', 400);
    if (!organizationId) throw new HttpError('organizationId is required', 400);
    if (!role) throw new HttpError('role is required', 400);

    const { error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('user_id', userId)
      .eq('organization_id', organizationId);
    if (error) throw postgresHttpError(error, 'Failed to update organization role');

    await logAdminAction(admin, {
      action: 'organizer.role_update',
      targetType: 'organizer',
      targetId: organizationId,
      metadata: { userId, role }
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to update roles');
  }
};

/** Revoke an organizer affiliation. */
export const DELETE = async ({ locals, url }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_users');

  try {
    const userId = url.searchParams.get('userId');
    const organizationId = url.searchParams.get('organizationId');
    if (!userId || !organizationId) {
      throw new HttpError('userId and organizationId are required', 400);
    }

    const { error } = await locals.supabase.rpc('remove_organization_member', {
      p_user_id: userId,
      p_organization_id: organizationId
    });

    if (error) {
      console.error('Error revoking organizer affiliation:', error);
      throw postgresHttpError(error, 'Failed to revoke affiliation');
    }

    await logAdminAction(admin, {
      action: 'organizer.affiliation_revoke',
      targetType: 'organizer',
      targetId: organizationId,
      metadata: { userId }
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to revoke affiliation');
  }
};
