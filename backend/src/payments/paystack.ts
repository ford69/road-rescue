import crypto from 'node:crypto';
import { env } from '../config/env.js';

const PAYSTACK_API = 'https://api.paystack.co';

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

async function paystackRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack is not configured');
  }
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as PaystackEnvelope<T>;
  if (!response.ok || !payload.status) {
    throw new Error(payload.message || 'Paystack request failed');
  }
  return payload.data;
}

export function isPaystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY);
}

export async function initializePaystackPayment(input: {
  email: string;
  amountGhs: number;
  reference: string;
  requestId: string;
}): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const data = await paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountGhs * 100),
      currency: 'GHS',
      reference: input.reference,
      channels: ['card', 'mobile_money'],
      callback_url:
        env.PAYSTACK_CALLBACK_URL ?? `${env.CLIENT_ORIGIN}/customer/history`,
      metadata: { requestId: input.requestId },
    }),
  });
  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}

export async function verifyPaystackPayment(reference: string) {
  return paystackRequest<{
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string;
    channel?: string;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export function verifyPaystackSignature(rawBody: Buffer, signature?: string): boolean {
  if (!env.PAYSTACK_SECRET_KEY || !signature) return false;
  const expected = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  const supplied = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return (
    supplied.length === expectedBuffer.length &&
    crypto.timingSafeEqual(supplied, expectedBuffer)
  );
}
