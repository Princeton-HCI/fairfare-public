import { json, type RequestEvent } from '@sveltejs/kit';
import { handleWebhook } from './handleWebhook';

export const POST = async ({ request }: RequestEvent) => {
  try {
    const resp = await request.json();
    await handleWebhook(resp);
    return json({ error: '' }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      return json({ error: error.message }, { status: 500 });
    } else {
      console.error('Webhook error:', error);
      return json({ error: 'Webhook error' }, { status: 500 });
    }
  }
};
