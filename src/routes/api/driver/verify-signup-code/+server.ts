import { json, type RequestEvent } from '@sveltejs/kit';
import { getOrganizationByKey } from '@src/lib/server/organizationArgyle';
import { verifySignupCode } from '@src/lib/server/signupCode';

export const POST = async ({ locals, request, getClientAddress }: RequestEvent) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { orgKey?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof body.orgKey !== 'string' || !body.orgKey) {
    return json({ error: 'orgKey is required' }, { status: 400 });
  }
  if (typeof body.code !== 'string' || !body.code) {
    return json({ error: 'code is required' }, { status: 400 });
  }

  const organization = await getOrganizationByKey(body.orgKey);
  if (!organization || organization.status !== 'active') {
    return json({ error: 'Organization not found' }, { status: 404 });
  }

  const result = await verifySignupCode(
    organization.id,
    organization.driver_signup_code,
    body.code,
    getClientAddress()
  );

  if (result.ok) {
    return json({ ok: true });
  }

  if (result.reason === 'rate_limited') {
    return json(
      { error: 'Too many failed attempts. Please try again in 10 minutes.' },
      { status: 429 }
    );
  }

  if (result.reason === 'no_code_configured') {
    return json({ ok: true });
  }

  return json({ error: 'Invalid signup code' }, { status: 403 });
};
