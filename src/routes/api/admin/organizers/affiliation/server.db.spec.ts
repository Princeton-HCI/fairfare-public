import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST, PATCH, DELETE } from './+server';
import { logAdminAction } from '@src/lib/server/adminAudit';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@src/lib/server/db', () => ({ supabase: { from: mocks.from } }));
vi.mock('@src/lib/server/adminAudit', () => ({ logAdminAction: vi.fn() }));

function event(method: string, platformRole = 'admin') {
  return {
    locals: {
      safeGetSession: async () => ({
        user: { id: 'admin-1', email: 'admin@example.test' },
        session: {},
        roles: { userId: 'admin-1', platformRole, orgRoles: {} }
      }),
      supabase: { rpc: mocks.rpc }
    },
    request: new Request('http://localhost/api/admin/organizers/affiliation', {
      method,
      ...(method === 'DELETE'
        ? {}
        : {
            body: JSON.stringify({ userId: 'member-1', organizationId: 'org-1', role: 'organizer' })
          })
    }),
    url: new URL(
      'http://localhost/api/admin/organizers/affiliation?userId=member-1&organizationId=org-1'
    )
  } as unknown as RequestEvent;
}

beforeEach(() => vi.clearAllMocks());

describe('admin membership endpoints', () => {
  it('revokes via the transactional RPC that also removes the login grant', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    expect((await DELETE(event('DELETE'))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('remove_organization_member', {
      p_user_id: 'member-1',
      p_organization_id: 'org-1'
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(logAdminAction).toHaveBeenCalledOnce();
  });

  // A membership rule the database refused surfaces as a 409 carrying its own
  // message, and the action is not logged as a success. The last-lead guard
  // exempts admins, so the message here stands in for any future P0001 rule.
  it('reports a refused membership rule as a conflict and does not record success', async () => {
    mocks.rpc.mockResolvedValue({
      error: { code: 'P0001', message: 'membership rule violated' }
    });
    const response = await DELETE(event('DELETE'));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'membership rule violated' });
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it.each([
    ['POST', POST],
    ['PATCH', PATCH]
  ] as const)('reports database guard failures from %s as conflicts', async (method, handler) => {
    const result = { error: { code: 'P0001', message: 'membership rule violated' } };
    const query = { update: vi.fn(), eq: vi.fn(), upsert: vi.fn().mockResolvedValue(result) };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce(result);
    mocks.from.mockReturnValue(query);
    expect((await handler(event(method))).status).toBe(409);
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it('rejects researcher mutations before touching the database', async () => {
    await expect(DELETE(event('DELETE', 'researcher'))).rejects.toMatchObject({ status: 403 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
