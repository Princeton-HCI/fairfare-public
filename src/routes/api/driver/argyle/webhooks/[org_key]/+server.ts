import { json, type RequestEvent } from '@sveltejs/kit';
import { handleWebhook } from '../handleWebhook';
import { verifyArgyleWebhookSignature, WebhookSignatureError } from '$lib/server/webhookAuth';
import { resolveArgyleCredentials } from '$lib/server/organizationArgyle';

export const POST = async ({ request, params }: RequestEvent) => {
  try {
    const orgKey = params.org_key;
    if (!orgKey) {
      return json({ error: 'Organization key is required' }, { status: 400 });
    }

    const credentials = await resolveArgyleCredentials({ by: 'orgKey', organizationKey: orgKey });
    if (!credentials) {
      return json({ error: 'Organization webhook config not found' }, { status: 404 });
    }

    if (!credentials.isActive) {
      return json({ error: 'Organization Argyle config is inactive' }, { status: 410 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('X-Argyle-Signature');

    verifyArgyleWebhookSignature(rawBody, signature, credentials.webhookSecret);

    const resp = JSON.parse(rawBody);
    await handleWebhook(resp, {
      credentials,
      organizationId: credentials.organizationId
    });

    return json({ error: '' }, { status: 200 });
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      console.error('Webhook signature verification failed:', error.message);
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error) {
      console.error(error.message);
      return json({ error: error.message }, { status: 500 });
    }
    console.error('Webhook error:', error);
    return json({ error: 'Webhook error' }, { status: 500 });
  }
};
