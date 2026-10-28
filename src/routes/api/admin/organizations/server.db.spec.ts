import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';

const ADMIN_EMAIL = uniqueTestEmail('adminorgendpoint');
const TEST_KEY = `admin-test-org-${Math.random().toString(36).slice(2, 8)}`;

let adminUserId: string;

const adminLocals = () =>
  ({
    safeGetSession: async () => ({
      session: { access_token: 'x' },
      user: { id: adminUserId, email: ADMIN_EMAIL },
      profile: null,
      roles: { userId: adminUserId, platformRole: 'admin', orgRoles: {} }
    })
  }) as unknown as App.Locals;

const anonLocals = () =>
  ({
    safeGetSession: async () => ({
      session: null,
      user: null,
      profile: null,
      roles: { userId: '', platformRole: null, orgRoles: {} }
    })
  }) as unknown as App.Locals;

const eventWith = (locals: App.Locals, body: unknown): RequestEvent =>
  ({
    locals,
    request: { json: async () => body }
  }) as unknown as RequestEvent;

describe('POST /api/admin/organizations', () => {
  beforeAll(async () => {
    const user = await createTestUserByEmail(ADMIN_EMAIL);
    adminUserId = user.id;
  });

  afterAll(async () => {
    await supabase.from('admin_activity_log').delete().eq('admin_user_id', adminUserId);
    await supabase.from('affiliate_organizations').delete().eq('key', TEST_KEY);
    await teardownTestUserByUserId(adminUserId);
  });

  it('rejects unauthenticated requests with 401', async () => {
    // requireAdminApi throws a SvelteKit error(401); the framework turns that
    // into a 401 response (verified via the running server). Here we assert the throw.
    await expect(POST(eventWith(anonLocals(), { name: 'X', key: TEST_KEY }))).rejects.toMatchObject(
      {
        status: 401
      }
    );
  });

  it('rejects an invalid key with 400', async () => {
    const res = await POST(eventWith(adminLocals(), { name: 'Bad', key: 'Has Spaces!' }));
    expect(res.status).toBe(400);
  });

  it('creates an organization and writes an audit row', async () => {
    const res = await POST(
      eventWith(adminLocals(), { name: 'Admin Test Org', key: TEST_KEY, url: 'https://x.test' })
    );
    expect(res.status).toBe(200);

    const { data: org } = await supabase
      .from('affiliate_organizations')
      .select('key, name, status, signup_code')
      .eq('key', TEST_KEY)
      .single();
    expect(org?.name).toBe('Admin Test Org');
    expect(org?.status).toBe('active');
    expect(org?.signup_code).toBeTruthy();

    const { data: audit } = await supabase
      .from('admin_activity_log')
      .select('action, target_type, target_id, admin_user_id')
      .eq('admin_user_id', adminUserId)
      .eq('action', 'organization.create');
    expect(audit && audit.length).toBeGreaterThan(0);
    expect(audit?.[0].target_id).toBe(TEST_KEY);
  });

  it('rejects a duplicate key with 409', async () => {
    const res = await POST(eventWith(adminLocals(), { name: 'Dup', key: TEST_KEY }));
    expect(res.status).toBe(409);
  });
});
