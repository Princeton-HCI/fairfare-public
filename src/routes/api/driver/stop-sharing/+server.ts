import { json, type RequestEvent } from '@sveltejs/kit';
import { handleApiError } from '@src/lib/server/apiErrors';
import { stopSharing } from '@src/lib/server/driverOrgSharing';
import { SYSTEM_VIRTUAL_PRIMARY_KEY } from '@src/lib/affiliationConstants';

export const POST = async ({ request, locals: { safeGetSession } }: RequestEvent) => {
  const { user } = await safeGetSession();
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parseStopSharingBody(body);
  if (!parsed.ok) {
    return json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await stopSharing(user.id, parsed.scope);
    return json(result);
  } catch (error) {
    return handleApiError(error, 'Error stopping sharing');
  }
};

type ParseResult =
  | {
      ok: true;
      scope: { kind: 'organization'; affiliationKey: string } | { kind: 'virtual-primary' };
    }
  | { ok: false; error: string };

const parseStopSharingBody = (body: unknown): ParseResult => {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body' };
  const b = body as Record<string, unknown>;

  if (b.scope === 'virtual-primary') return { ok: true, scope: { kind: 'virtual-primary' } };

  if (b.scope === 'organization' && typeof b.affiliationKey === 'string' && b.affiliationKey) {
    return {
      ok: true,
      scope: { kind: 'organization', affiliationKey: b.affiliationKey }
    };
  }

  // Legacy body: `{ affiliationKey: '...' }`
  if (typeof b.affiliationKey === 'string' && b.affiliationKey) {
    if (b.affiliationKey === SYSTEM_VIRTUAL_PRIMARY_KEY) {
      return { ok: true, scope: { kind: 'virtual-primary' } };
    }
    return { ok: true, scope: { kind: 'organization', affiliationKey: b.affiliationKey } };
  }

  return { ok: false, error: 'Missing scope or affiliationKey' };
};
