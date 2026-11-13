import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdminApi } from '@src/lib/server/adminAuth';
import { logAdminAction } from '@src/lib/server/adminAudit';
import { HttpError, handleApiError, readJsonBody, stringField } from '@src/lib/server/apiErrors';
import {
  connectOrganizationArgyleConfig,
  disconnectOrganizationArgyleConfig,
  updateOrganizationArgyleControls
} from '@src/lib/server/organizerArgyleConfig';

/**
 * Admin wrappers around the shared organization Argyle config logic. They reuse
 * the exact connect/disconnect/limit functions (and their webhook + encryption
 * side-effects); the platform `admin` role holds `org:manage_argyle_settings`
 * for every organization, so the same capability check authorizes them.
 */

export const POST = async ({ locals, request, url }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_orgs');

  try {
    const body = await readJsonBody(request);
    const organizationKey = stringField(body, 'organizationKey');
    if (!organizationKey) throw new HttpError('organizationKey is required', 400);

    await connectOrganizationArgyleConfig({
      roles: admin.roles,
      organizationKey,
      apiKeyId: stringField(body, 'apiKeyId') || null,
      apiKeySecret: stringField(body, 'apiKeySecret') || null,
      flowId: stringField(body, 'flowId') || null,
      maxArgyleAccounts:
        typeof body?.maxArgyleAccounts === 'number' ? body.maxArgyleAccounts : null,
      requestOrigin: url.origin
    });

    await logAdminAction(admin, {
      action: 'organization.argyle_connect',
      targetType: 'config',
      targetId: organizationKey
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to connect Argyle configuration');
  }
};

export const PATCH = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_orgs');

  try {
    const body = await readJsonBody(request);
    const organizationKey = stringField(body, 'organizationKey');
    if (!organizationKey) throw new HttpError('organizationKey is required', 400);
    const maxArgyleAccounts =
      typeof body?.maxArgyleAccounts === 'number' ? body.maxArgyleAccounts : null;

    await updateOrganizationArgyleControls({
      roles: admin.roles,
      organizationKey,
      maxArgyleAccounts
    });

    await logAdminAction(admin, {
      action: 'organization.argyle_update_limits',
      targetType: 'config',
      targetId: organizationKey,
      metadata: { maxArgyleAccounts }
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to update Argyle settings');
  }
};

export const DELETE = async ({ locals, url }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_orgs');

  try {
    const organizationKey = url.searchParams.get('organizationKey');
    if (!organizationKey) throw new HttpError('organizationKey is required', 400);

    await disconnectOrganizationArgyleConfig({
      roles: admin.roles,
      organizationKey
    });

    await logAdminAction(admin, {
      action: 'organization.argyle_disconnect',
      targetType: 'config',
      targetId: organizationKey
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to disconnect Argyle configuration');
  }
};
