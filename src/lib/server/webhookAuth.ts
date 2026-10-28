import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '$env/dynamic/private';

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

export function verifyArgyleWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined = env.ARGYLE_WEBHOOK_SECRET
): boolean {
  if (!secret) {
    throw new WebhookSignatureError('ARGYLE_WEBHOOK_SECRET is not configured');
  }

  if (!signature) {
    throw new WebhookSignatureError('Missing X-Argyle-Signature header');
  }

  const expectedSignature = createHmac('sha512', secret).update(rawBody).digest('hex');

  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length) {
    throw new WebhookSignatureError('Invalid webhook signature');
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new WebhookSignatureError('Invalid webhook signature');
  }

  return true;
}
