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
  requestId?: string;
  callbackUrl?: string;
  metadata?: Record<string, string>;
  providerSubaccountCode?: string;
  platformFeePercent: number;
  channels?: Array<'card' | 'mobile_money'>;
}): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const metadata: Record<string, string> = { ...(input.metadata ?? {}) };
  if (input.requestId) metadata.requestId = input.requestId;

  const body: Record<string, unknown> = {
    email: input.email,
    amount: Math.round(input.amountGhs * 100),
    currency: 'GHS',
    reference: input.reference,
    channels: input.channels ?? ['card', 'mobile_money'],
    callback_url:
      input.callbackUrl ??
      env.PAYSTACK_CALLBACK_URL ??
      `${env.PRIMARY_CLIENT_ORIGIN}/customer/history`,
    metadata,
  };

  if (input.providerSubaccountCode) {
    const providerShare = Math.max(0, 100 - input.platformFeePercent);
    body.split = {
      type: 'percentage',
      bearer_type: 'account',
      subaccounts: [
        {
          subaccount: input.providerSubaccountCode,
          share: providerShare,
        },
      ],
    };
  }

  const data = await paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(body),
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
    authorization?: {
      authorization_code?: string;
      reusable?: boolean;
      channel?: string;
      card_type?: string;
      last4?: string;
      bank?: string;
    };
    customer?: {
      customer_code?: string;
      email?: string;
    };
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function refundPaystackTransaction(input: {
  reference: string;
  merchantNote?: string;
}): Promise<{ status: string; transaction?: { reference?: string } }> {
  return paystackRequest('/refund', {
    method: 'POST',
    body: JSON.stringify({
      transaction: input.reference,
      merchant_note: input.merchantNote ?? 'Card verification / tokenization refund',
    }),
  });
}

export async function createPaystackSubscription(input: {
  customer: string;
  planCode: string;
  authorizationCode: string;
  startDate: Date;
}): Promise<{ subscription_code: string; email_token?: string; status?: string }> {
  return paystackRequest('/subscription', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customer,
      plan: input.planCode,
      authorization: input.authorizationCode,
      start_date: input.startDate.toISOString(),
    }),
  });
}

export function verifyPaystackSignature(rawBody: Buffer, signature?: string): boolean {
  const secret = env.PAYSTACK_WEBHOOK_SECRET || env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const supplied = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return (
    supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer)
  );
}

export async function initializePaystackSubscription(input: {
  email: string;
  amountGhs: number;
  reference: string;
  planCode: string;
  callbackUrl: string;
  metadata: Record<string, string>;
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
      plan: input.planCode,
      channels: ['card', 'mobile_money'],
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}
