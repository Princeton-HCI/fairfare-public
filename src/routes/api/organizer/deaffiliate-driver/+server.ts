import { json, type RequestEvent } from '@sveltejs/kit';
import { handleApiError } from '@src/lib/server/apiErrors';
import { supabase } from '@src/lib/server/db';
import { deaffiliateDriver } from '@src/lib/server/driverOrgSharing';
import { logOrganizerAction } from '@src/lib/server/organizationMembership';
import { requireCapability } from '@src/lib/server/rbac';

export const POST = async ({ locals, request }: RequestEvent) => {
  const { user, roles } = await locals.safeGetSession();
  if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: { driverUserId?: unknown; organizationKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof body.driverUserId !== 'string' || !body.driverUserId) {
    return json({ error: 'driverUserId is required' }, { status: 400 });
  }
  if (typeof body.organizationKey !== 'string' || !body.organizationKey) {
    return json({ error: 'organizationKey is required' }, { status: 400 });
  }

  try {
    requireCapability(roles, 'org:deaffiliate_driver', body.organizationKey);
    const result = await deaffiliateDriver(user.id, body.driverUserId, body.organizationKey);
    await logOrganizerAction(supabase, {
      userId: user.id,
      action: 'removed_driver',
      additionalData: {
        organizationKey: body.organizationKey,
        driverUserId: body.driverUserId,
        wasPrimary: result.isPrimary
      }
    });
    return json(result);
  } catch (error) {
    return handleApiError(error, 'Failed to remove driver from organization');
  }
};
