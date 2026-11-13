import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';

const ADMIN_EMAIL = uniqueTestEmail('adminrotatecode');
const TEST_KEY = `admin-rotate-${Math.random().toString(36).slice(2, 8)}`;

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

const eventWith = (body: unknown): RequestEvent =>
  ({ locals: adminLocals(), request: { json: async () => body } }) as unknown as RequestEvent;

async function getSignupCode(): Promise<string | null> {
  const { data } = await supabase
    .from('affiliate_organizations')
    .select('signup_code')
    .eq('key', TEST_KEY)
    .single();
  return data?.signup_code ?? null;
}

describe('POST /api/admin/organizations/rotate-code', () => {
  beforeAll(async () => {
    const user = await createTestUserByEmail(ADMIN_EMAIL);
    adminUserId = user.id;
    await supabase
      .from('affiliate_organizations')
      .insert({ key: TEST_KEY, name: 'Rotate Test', signup_code: 'initial', status: 'active' });
  });

  afterAll(async () => {
    await supabase.from('admin_activity_log').delete().eq('admin_user_id', adminUserId);
    await supabase.from('affiliate_organizations').delete().eq('key', TEST_KEY);
    await teardownTestUserByUserId(adminUserId);
  });

  it('regenerates the organizer signup code to a new non-empty value', async () => {
    const res = await POST(eventWith({ key: TEST_KEY, regenerate: true }));
    expect(res.status).toBe(200);
    const code = await getSignupCode();
    expect(code).toBeTruthy();
    expect(code).not.toBe('initial');
  });

  it('sets the organizer signup code to a custom value', async () => {
    const res = await POST(eventWith({ key: TEST_KEY, signupCode: '  my-custom-code  ' }));
    expect(res.status).toBe(200);
    expect(await getSignupCode()).toBe('my-custom-code');
  });

  it('removes (clears) the organizer signup code', async () => {
    const res = await POST(eventWith({ key: TEST_KEY, clearSignupCode: true }));
    expect(res.status).toBe(200);
    expect(await getSignupCode()).toBeNull();
  });

  it('rejects when there is nothing to update', async () => {
    const res = await POST(eventWith({ key: TEST_KEY }));
    expect(res.status).toBe(400);
  });
});
