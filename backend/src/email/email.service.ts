import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { isBrevoConfigured, sendBrevoEmail } from './brevo.js';
import {
  buildAuthActionUrl,
  buildMechanicPendingContent,
  buildResetPasswordContent,
  buildVerifyEmailContent,
  buildWelcomeContent,
  getBrevoTemplateId,
  type EmailTemplateKey,
} from './templates.js';

export interface SendEmailResult {
  sent: boolean;
  skipped: boolean;
  messageId?: string;
  reason?: string;
}

async function dispatchEmail(input: {
  key: EmailTemplateKey;
  to: { email: string; name?: string };
  subject: string;
  htmlContent: string;
  textContent: string;
  params: Record<string, string>;
  tags: string[];
}): Promise<SendEmailResult> {
  if (!isBrevoConfigured()) {
    logger.info('Email skipped — Brevo not configured', {
      template: input.key,
      to: input.to.email,
      previewSubject: input.subject,
      previewParams: input.params,
    });
    return { sent: false, skipped: true, reason: 'BREVO_API_KEY not set' };
  }

  const templateId = getBrevoTemplateId(input.key);
  const result = await sendBrevoEmail({
    to: [input.to],
    tags: input.tags,
    params: input.params,
    ...(templateId
      ? { templateId }
      : {
          subject: input.subject,
          htmlContent: input.htmlContent,
          textContent: input.textContent,
        }),
  });

  logger.info('Email sent via Brevo', {
    template: input.key,
    to: input.to.email,
    messageId: result.messageId,
    usedTemplateId: Boolean(templateId),
  });

  return { sent: true, skipped: false, messageId: result.messageId };
}

/**
 * Domain email API for product flows.
 * Failures are logged and returned — callers should not block user signup on email outages.
 */
export const emailService = {
  isConfigured: isBrevoConfigured,

  async sendVerificationEmail(input: {
    email: string;
    firstName: string;
    token: string;
  }): Promise<SendEmailResult> {
    const actionUrl = buildAuthActionUrl('/auth/verify-email', input.token);
    const content = buildVerifyEmailContent({
      firstName: input.firstName,
      actionUrl,
    });

    try {
      return await dispatchEmail({
        key: 'verify_email',
        to: { email: input.email, name: input.firstName },
        subject: content.subject,
        htmlContent: content.htmlContent,
        textContent: content.textContent,
        params: content.params,
        tags: ['verify-email'],
      });
    } catch (error) {
      logger.error('Failed to send verification email', {
        email: input.email,
        error: error instanceof Error ? error.message : String(error),
      });
      return { sent: false, skipped: false, reason: 'send_failed' };
    }
  },

  async sendPasswordResetEmail(input: {
    email: string;
    firstName: string;
    token: string;
  }): Promise<SendEmailResult> {
    const actionUrl = buildAuthActionUrl('/auth/reset-password', input.token);
    const content = buildResetPasswordContent({
      firstName: input.firstName,
      actionUrl,
    });

    try {
      return await dispatchEmail({
        key: 'reset_password',
        to: { email: input.email, name: input.firstName },
        subject: content.subject,
        htmlContent: content.htmlContent,
        textContent: content.textContent,
        params: content.params,
        tags: ['reset-password'],
      });
    } catch (error) {
      logger.error('Failed to send password reset email', {
        email: input.email,
        error: error instanceof Error ? error.message : String(error),
      });
      return { sent: false, skipped: false, reason: 'send_failed' };
    }
  },

  async sendWelcomeEmail(input: {
    email: string;
    firstName: string;
    role: 'customer' | 'mechanic';
  }): Promise<SendEmailResult> {
    const content = buildWelcomeContent(input);
    try {
      return await dispatchEmail({
        key: 'welcome',
        to: { email: input.email, name: input.firstName },
        subject: content.subject,
        htmlContent: content.htmlContent,
        textContent: content.textContent,
        params: content.params,
        tags: ['welcome', input.role],
      });
    } catch (error) {
      logger.error('Failed to send welcome email', {
        email: input.email,
        error: error instanceof Error ? error.message : String(error),
      });
      return { sent: false, skipped: false, reason: 'send_failed' };
    }
  },

  async sendMechanicApplicationReceivedEmail(input: {
    email: string;
    firstName: string;
    garageName: string;
  }): Promise<SendEmailResult> {
    const content = buildMechanicPendingContent(input);
    try {
      return await dispatchEmail({
        key: 'mechanic_pending',
        to: { email: input.email, name: input.firstName },
        subject: content.subject,
        htmlContent: content.htmlContent,
        textContent: content.textContent,
        params: content.params,
        tags: ['mechanic-pending'],
      });
    } catch (error) {
      logger.error('Failed to send mechanic application email', {
        email: input.email,
        error: error instanceof Error ? error.message : String(error),
      });
      return { sent: false, skipped: false, reason: 'send_failed' };
    }
  },

  /** Dev helper: confirms Brevo credentials and sender identity. */
  async sendTestEmail(toEmail: string): Promise<SendEmailResult> {
    if (!isBrevoConfigured()) {
      return { sent: false, skipped: true, reason: 'BREVO_API_KEY not set' };
    }

    try {
      const result = await sendBrevoEmail({
        to: [{ email: toEmail }],
        subject: 'Road Rescue Ghana — Brevo test',
        htmlContent: `<p>Brevo is configured for <strong>${env.BREVO_SENDER_EMAIL}</strong>.</p>`,
        textContent: `Brevo is configured for ${env.BREVO_SENDER_EMAIL}.`,
        tags: ['test'],
      });
      return { sent: true, skipped: false, messageId: result.messageId };
    } catch (error) {
      return {
        sent: false,
        skipped: false,
        reason: error instanceof Error ? error.message : 'send_failed',
      };
    }
  },
};
