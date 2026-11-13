import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'crypto';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import { encrypt } from '@src/lib/server/encryption';

const testWebhookSecret = 'webhook-secret-for-this-org';
const buildSignature = (rawBody: string) =>
  createHmac('sha512', testWebhookSecret).update(rawBody).digest('hex');

const buildRequestEvent = (
  orgKey: string,
  body: object,
  options: { signature?: string | null } = {}
) => {
  const rawBody = JSON.stringify(body);
  const signature = 'signature' in options ? options.signature : buildSignature(rawBody);

  const request = new Request(`http://localhost/api/driver/argyle/webhooks/${orgKey}`, {
    method: 'POST',
    headers: signature ? { 'X-Argyle-Signature': signature } : {},
    body: rawBody
  });
  return {
    request,
    params: { org_key: orgKey }
  } as unknown as Parameters<typeof POST>[0];
};

describe('POST /api/driver/argyle/webhooks/[org_key]', () => {
  const orgKey = `webhook-route-test-${randomUUID().slice(0, 8)}`;
  let orgId: string;

  beforeEach(async () => {
    const { data: org } = await supabase
      .from('affiliate_organizations')
      .upsert({ key: orgKey, name: 'Webhook Route Test', status: 'active' }, { onConflict: 'key' })
      .select('id')
      .single();
    if (!org) throw new Error('org not created');
    orgId = org.id;

    await supabase.from('organization_argyle_configs').upsert(
      {
        organization_id: orgId,
        api_key_id: 'k',
        api_key_secret: encrypt('s', orgId),
        webhook_secret: encrypt(testWebhookSecret, orgId),
        link_url: 'https://api-sandbox.argyle.com',
        is_active: true
      },
      { onConflict: 'organization_id' }
    );
  });

  afterEach(async () => {
    if (!orgId) return;
    await supabase.from('organization_argyle_configs').delete().eq('organization_id', orgId);
    await supabase.from('affiliate_organizations').delete().eq('id', orgId);
  });

  it('returns 404 for an unknown org key', async () => {
    const response = await POST(
      buildRequestEvent('does-not-exist', { event: 'noop', name: 'noop', data: {} })
    );
    expect(response.status).toBe(404);
  });

  it('returns 410 when config is inactive', async () => {
    await supabase
      .from('organization_argyle_configs')
      .update({ is_active: false })
      .eq('organization_id', orgId);

    const response = await POST(
      buildRequestEvent(orgKey, { event: 'noop', name: 'noop', data: {} })
    );
    expect(response.status).toBe(410);
  });

  it('returns 401 when signature is missing', async () => {
    const response = await POST(
      buildRequestEvent(orgKey, { event: 'noop', name: 'noop', data: {} }, { signature: null })
    );
    expect(response.status).toBe(401);
  });

  it('returns 401 when signature is wrong', async () => {
    const response = await POST(
      buildRequestEvent(
        orgKey,
        { event: 'noop', name: 'noop', data: {} },
        { signature: 'a'.repeat(128) }
      )
    );
    expect(response.status).toBe(401);
  });
});
