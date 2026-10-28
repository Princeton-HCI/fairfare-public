import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdminApi } from '@src/lib/server/adminAuth';
import { logAdminAction } from '@src/lib/server/adminAudit';
import { HttpError, handleApiError, readJsonBody, stringField } from '@src/lib/server/apiErrors';
import { deaffiliateDriver } from '@src/lib/server/driverOrgSharing';

/**
 * Deactivate a driver within one organization (soft): removes their affiliation
 * and data sharing for that org, but keeps the account. Reuses the same
 * deaffiliation logic the organizer dashboard uses.
 */
export const POST = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_drivers');

  try {
    const body = await readJsonBody(request);
    const driverUserId = stringField(body, 'driverUserId');
    const organizationKey = stringField(body, 'organizationKey');
    if (!driverUserId) throw new HttpError('driverUserId is required', 400);
    if (!organizationKey) throw new HttpError('organizationKey is required', 400);

    const result = await deaffiliateDriver(admin.user.id, driverUserId, organizationKey);

    await logAdminAction(admin, {
      action: 'driver.deactivate',
      targetType: 'driver',
      targetId: driverUserId,
      metadata: { organizationKey, wasPrimary: result.isPrimary }
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to deactivate driver');
  }
};
