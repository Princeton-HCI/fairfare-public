import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import { encrypt } from '@src/lib/server/encryption';

const buildEvent = (userId: string, body: unknown) =>
  ({
    request: new Request('http://localhost/api/driver/argyle/connect-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
    locals: {
      safeGetSession: async () => ({ user: { id: userId } as { id: string }, session: {} })
    }
  }) as unknown as Parameters<typeof POST>[0];

describe('POST /api/driver/argyle/connect-account', () => {
  const orgKey = `capacity-test-${randomUUID().slice(0, 6)}`;
  let orgId: string;
  let user1: string;
  let user2: string;

  beforeEach(async () => {
    const { data: org } = await supabase
      .from('affiliate_organizations')
      .upsert({ key: orgKey, name: 'Cap', status: 'active' }, { onConflict: 'key' })
      .select('id')
      .single();
    orgId = org!.id;

    await supabase.from('organization_argyle_configs').upsert(
      {
        organization_id: orgId,
        api_key_id: 'k',
        api_key_secret: encrypt('s', orgId),
        webhook_secret: encrypt('w', orgId),
        link_url: 'https://api-sandbox.argyle.com',
        is_active: true,
        max_argyle_accounts: 1
      },
      { onConflict: 'organization_id' }
    );

    const u1 = await supabase.auth.admin.createUser({
      email: `cap1-${randomUUID()}@test.test`,
      email_confirm: true
    });
    const u2 = await supabase.auth.admin.createUser({
      email: `cap2-${randomUUID()}@test.test`,
      email_confirm: true
    });
    user1 = u1.data.user!.id;
    user2 = u2.data.user!.id;
  });

  afterEach(async () => {
    if (orgId) {
      await supabase.from('argyle_accounts').delete().eq('organization_id', orgId);
      await supabase.from('organization_argyle_configs').delete().eq('organization_id', orgId);
      await supabase.from('affiliate_organizations').delete().eq('id', orgId);
    }
    if (user1) await supabase.auth.admin.deleteUser(user1);
    if (user2) await supabase.auth.admin.deleteUser(user2);
  });

  it('first connect succeeds, second connect at cap returns 409 over_capacity', async () => {
    const r1 = await POST(
      buildEvent(user1, {
        orgKey,
        argyleUserId: randomUUID(),
        accountId: randomUUID()
      })
    );
    expect(r1.status).toBe(200);

    const r2 = await POST(
      buildEvent(user2, {
        orgKey,
        argyleUserId: randomUUID(),
        accountId: randomUUID()
      })
    );
    expect(r2.status).toBe(409);
    const body = (await r2.json()) as { error?: string; maxCount?: number };
    expect(body.maxCount).toBe(1);
  });

  it('two parallel calls at max-1 result in exactly one success', async () => {
    await supabase
      .from('organization_argyle_configs')
      .update({ max_argyle_accounts: 2 })
      .eq('organization_id', orgId);

    const u3 = await supabase.auth.admin.createUser({
      email: `cap3-${randomUUID()}@test.test`,
      email_confirm: true
    });

    try {
      const results = await Promise.all([
        POST(buildEvent(user1, { orgKey, argyleUserId: randomUUID(), accountId: randomUUID() })),
        POST(buildEvent(user2, { orgKey, argyleUserId: randomUUID(), accountId: randomUUID() })),
        POST(
          buildEvent(u3.data.user!.id, {
            orgKey,
            argyleUserId: randomUUID(),
            accountId: randomUUID()
          })
        )
      ]);

      const statuses = results.map((r) => r.status);
      const successes = statuses.filter((s) => s === 200).length;
      const conflicts = statuses.filter((s) => s === 409).length;

      expect(successes).toBe(2);
      expect(conflicts).toBe(1);
    } finally {
      await supabase.auth.admin.deleteUser(u3.data.user!.id);
    }
  });

  it('returns 410 when org config is inactive', async () => {
    await supabase
      .from('organization_argyle_configs')
      .update({ is_active: false })
      .eq('organization_id', orgId);

    const r = await POST(
      buildEvent(user1, { orgKey, argyleUserId: randomUUID(), accountId: randomUUID() })
    );
    expect(r.status).toBe(410);
  });
});
