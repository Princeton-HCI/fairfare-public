import { json, type RequestEvent } from '@sveltejs/kit';
import { handleWebhook } from './handleWebhook';
import { verifyArgyleWebhookSignature, WebhookSignatureError } from '$lib/server/webhookAuth';

export const POST = async ({ request }: RequestEvent) => {
  try {
    // Get the raw body text before parsing - required for signature verification
    const rawBody = await request.text();

    // Verify the webhook signature
    const signature = request.headers.get('X-Argyle-Signature');
    verifyArgyleWebhookSignature(rawBody, signature);

    // Parse the verified payload
    const resp = JSON.parse(rawBody);
    await handleWebhook(resp);
    return json({ error: '' }, { status: 200 });
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      console.error('Webhook signature verification failed:', error.message);
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error) {
      console.error(error.message);
      return json({ error: error.message }, { status: 500 });
    } else {
      console.error('Webhook error:', error);
      return json({ error: 'Webhook error' }, { status: 500 });
    }
  }
};
