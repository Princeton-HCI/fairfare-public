import { json, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { requireAdminApi } from '@src/lib/server/adminAuth';
import { logAdminAction } from '@src/lib/server/adminAudit';
import { HttpError, handleApiError, readJsonBody, stringField } from '@src/lib/server/apiErrors';
import { generateSignupCode } from '@src/lib/server/signupCode';

const KEY_PATTERN = /^[a-z0-9-]+$/;

/** Create an organization. */
export const POST = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_orgs');

  try {
    const body = await readJsonBody(request);
    const name = stringField(body, 'name');
    const key = stringField(body, 'key').toLowerCase();
    const url = stringField(body, 'url') || null;

    if (!name) throw new HttpError('Name is required', 400);
    if (!key) throw new HttpError('Key is required', 400);
    if (!KEY_PATTERN.test(key)) {
      throw new HttpError('Key may only contain lowercase letters, numbers, and hyphens', 400);
    }

    const signupCode = generateSignupCode();
    const { data, error } = await supabase
      .from('affiliate_organizations')
      .insert({ name, key, url, signup_code: signupCode, status: 'active' })
      .select('id, key')
      .single();

    if (error) {
      if (error.code === '23505')
        throw new HttpError('An organization with that key already exists', 409);
      console.error('Error creating organization:', error);
      throw new HttpError('Failed to create organization', 500);
    }

    await logAdminAction(admin, {
      action: 'organization.create',
      targetType: 'organization',
      targetId: data.key,
      metadata: { name, key, url }
    });

    return json({ success: true, organization: data });
  } catch (error) {
    return handleApiError(error, 'Failed to create organization');
  }
};

/** Edit an organization's name/url (key is immutable). */
export const PATCH = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_orgs');

  try {
    const body = await readJsonBody(request);
    const key = stringField(body, 'key');
    if (!key) throw new HttpError('key is required', 400);

    const updates: { name?: string; url?: string | null } = {};
    if (typeof body?.name === 'string') {
      const name = stringField(body, 'name');
      // Create rejects a blank name; an edit must not be able to clear it either.
      if (!name) throw new HttpError('Name is required', 400);
      updates.name = name;
    }
    if ('url' in (body ?? {})) {
      updates.url = stringField(body, 'url') || null;
    }
    if (Object.keys(updates).length === 0) throw new HttpError('No fields to update', 400);

    const { data, error } = await supabase
      .from('affiliate_organizations')
      .update(updates)
      .eq('key', key)
      .select('id, key')
      .maybeSingle();

    if (error) {
      console.error('Error updating organization:', error);
      throw new HttpError('Failed to update organization', 500);
    }
    // An unknown key updates nothing; reporting that as a 500 hides a typo.
    if (!data) throw new HttpError('Organization not found', 404);

    await logAdminAction(admin, {
      action: 'organization.update',
      targetType: 'organization',
      targetId: key,
      metadata: updates
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to update organization');
  }
};

/** Soft-delete (status = 'deleted') or restore an organization. */
export const DELETE = async ({ locals, url }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_orgs');

  try {
    const key = url.searchParams.get('key');
    if (!key) throw new HttpError('key is required', 400);
    const restore = url.searchParams.get('restore') === 'true';
    const status = restore ? 'active' : 'deleted';

    const { data, error } = await supabase
      .from('affiliate_organizations')
      .update({ status })
      .eq('key', key)
      .select('id, key')
      .maybeSingle();

    if (error) {
      console.error('Error soft-deleting organization:', error);
      throw new HttpError('Failed to update organization status', 500);
    }
    if (!data) throw new HttpError('Organization not found', 404);

    await logAdminAction(admin, {
      action: restore ? 'organization.restore' : 'organization.soft_delete',
      targetType: 'organization',
      targetId: key
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to update organization status');
  }
};
