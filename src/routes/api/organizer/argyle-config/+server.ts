import { json, type RequestEvent } from '@sveltejs/kit';
import { handleApiError } from '@src/lib/server/apiErrors';
import {
  connectOrganizationArgyleConfig,
  disconnectOrganizationArgyleConfig,
  updateOrganizationArgyleControls
} from '@src/lib/server/organizerArgyleConfig';
import { supabase } from '@src/lib/server/db';
import { getOrganizationByKey } from '@src/lib/server/organizationArgyle';
import { requireCapability } from '@src/lib/server/rbac';
import type { AuthContext } from '@src/lib/rbac';

export const POST = async ({ locals, request, url }: RequestEvent) => {
  const { user, roles } = await locals.safeGetSession();
  if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  const organizationKey = typeof body.organizationKey === 'string' ? body.organizationKey : '';
  if (!organizationKey) {
    return json({ error: 'organizationKey is required' }, { status: 400 });
  }

  try {
    await connectOrganizationArgyleConfig({
      roles,
      organizationKey,
      apiKeyId: typeof body.apiKeyId === 'string' ? body.apiKeyId : null,
      apiKeySecret: typeof body.apiKeySecret === 'string' ? body.apiKeySecret : null,
      flowId: typeof body.flowId === 'string' ? body.flowId : null,
      maxArgyleAccounts: typeof body.maxArgyleAccounts === 'number' ? body.maxArgyleAccounts : null,
      requestOrigin: url.origin
    });

    if ('signupCodePlaintext' in body) {
      await setSignupCode(roles, organizationKey, body.signupCodePlaintext);
    }

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to connect Argyle configuration');
  }
};

export const PATCH = async ({ locals, request }: RequestEvent) => {
  const { user, roles } = await locals.safeGetSession();
  if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  const organizationKey = typeof body.organizationKey === 'string' ? body.organizationKey : '';
  if (!organizationKey) {
    return json({ error: 'organizationKey is required' }, { status: 400 });
  }

  try {
    await updateOrganizationArgyleControls({
      roles,
      organizationKey,
      maxArgyleAccounts: typeof body.maxArgyleAccounts === 'number' ? body.maxArgyleAccounts : null
    });

    if ('signupCodePlaintext' in body) {
      await setSignupCode(roles, organizationKey, body.signupCodePlaintext);
    }

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to update Argyle settings');
  }
};

export const DELETE = async ({ locals, url }: RequestEvent) => {
  const { user, roles } = await locals.safeGetSession();
  if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

  const organizationKey = url.searchParams.get('organizationKey');
  if (!organizationKey) {
    return json({ error: 'organizationKey is required' }, { status: 400 });
  }

  try {
    await disconnectOrganizationArgyleConfig({
      roles,
      organizationKey
    });
    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to disconnect Argyle configuration');
  }
};

const setSignupCode = async (
  roles: AuthContext,
  organizationKey: string,
  raw: unknown
): Promise<void> => {
  requireCapability(roles, 'org:manage_signup_code', organizationKey);

  const org = await getOrganizationByKey(organizationKey);
  if (!org) throw new Error('Organization not found');

  const code =
    raw === null ? null : typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;

  const { error } = await supabase
    .from('affiliate_organizations')
    .update({ driver_signup_code: code })
    .eq('id', org.id);

  if (error) {
    console.error('Failed to set driver_signup_code:', error);
    throw new Error('Failed to set signup code');
  }
};
