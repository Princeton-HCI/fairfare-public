import { json, type RequestEvent } from '@sveltejs/kit';
import { handleApiError } from '@src/lib/server/apiErrors';
import { createAffiliation } from '@src/lib/server/driverOrgSharing';

export const POST = async ({ locals, request, getClientAddress }: RequestEvent) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { orgKey?: unknown; signupCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof body.orgKey !== 'string' || !body.orgKey) {
    return json({ error: 'orgKey is required' }, { status: 400 });
  }
  const signupCode = typeof body.signupCode === 'string' ? body.signupCode : undefined;

  try {
    const result = await createAffiliation(user.id, body.orgKey, {
      isPrimary: false,
      signupCode,
      ipAddress: getClientAddress()
    });
    return json(result);
  } catch (error) {
    return handleApiError(error, 'Failed to create secondary affiliation');
  }
};
