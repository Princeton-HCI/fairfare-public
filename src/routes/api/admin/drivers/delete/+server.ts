import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdminApi } from '@src/lib/server/adminAuth';
import { logAdminAction } from '@src/lib/server/adminAudit';
import { HttpError, handleApiError, readJsonBody, stringField } from '@src/lib/server/apiErrors';
import optOut from '@src/lib/optOut';

function isUserNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: number; message?: string };
  return e.status === 404 || /not\s*found/i.test(e.message ?? '');
}

/**
 * Hard-delete a driver account. Reuses `optOut`, which notifies organizations
 * the driver shared data with, cascades their data, and removes the auth user.
 * Treats an already-deleted user as success (optOut is not idempotent).
 */
export const POST = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_drivers');

  try {
    const body = await readJsonBody(request);
    const driverUserId = stringField(body, 'driverUserId');
    if (!driverUserId) throw new HttpError('driverUserId is required', 400);

    try {
      await optOut(driverUserId);
    } catch (err) {
      if (!isUserNotFound(err)) throw err;
    }

    await logAdminAction(admin, {
      action: 'driver.delete',
      targetType: 'driver',
      targetId: driverUserId
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to delete driver');
  }
};
