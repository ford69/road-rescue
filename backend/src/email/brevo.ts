import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const BREVO_SMTP_EMAIL_PATH = '/smtp/email';

export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface BrevoSendPayload {
  to: BrevoRecipient[];
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, string | number | boolean>;
  tags?: string[];
  replyTo?: BrevoRecipient;
}

export interface BrevoSendResult {
  messageId: string;
}

interface BrevoErrorBody {
  message?: string;
  code?: string;
}

export function isBrevoConfigured(): boolean {
  return Boolean(env.BREVO_API_KEY);
}

export async function sendBrevoEmail(payload: BrevoSendPayload): Promise<BrevoSendResult> {
  if (!env.BREVO_API_KEY) {
    throw new Error('Brevo is not configured (BREVO_API_KEY missing)');
  }

  const body = {
    sender: {
      email: env.BREVO_SENDER_EMAIL,
      name: env.BREVO_SENDER_NAME,
    },
    to: payload.to,
    subject: payload.subject,
    htmlContent: payload.htmlContent,
    textContent: payload.textContent,
    templateId: payload.templateId,
    params: payload.params,
    tags: payload.tags,
    replyTo: payload.replyTo
      ? payload.replyTo
      : env.BREVO_REPLY_TO_EMAIL
        ? { email: env.BREVO_REPLY_TO_EMAIL, name: env.BREVO_SENDER_NAME }
        : undefined,
  };

  const response = await fetch(`${env.BREVO_API_URL}${BREVO_SMTP_EMAIL_PATH}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': env.BREVO_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const raw = (await response.json().catch(() => ({}))) as BrevoSendResult & BrevoErrorBody;

  if (!response.ok) {
    logger.error('Brevo send failed', {
      status: response.status,
      code: raw.code,
      message: raw.message,
      to: payload.to.map((recipient) => recipient.email),
      tags: payload.tags,
    });
    throw new Error(raw.message || `Brevo request failed (${response.status})`);
  }

  return { messageId: raw.messageId };
}
