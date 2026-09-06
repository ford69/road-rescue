import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { paymentService } from '../services/payment.service.js';
import { subscriptionService } from '../services/subscription.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../utils/errors.js';

export const paymentController = {
  browserCallback: (req: Request, res: Response) => {
    const params = new URLSearchParams();
    for (const key of ['reference', 'trxref'] as const) {
      const value = req.query[key];
      if (typeof value === 'string' && value) params.set(key, value);
    }
    const target = new URL(`${env.PRIMARY_CLIENT_ORIGIN}/auth/complete-subscription`);
    params.forEach((value, key) => target.searchParams.set(key, value));
    res.redirect(302, target.toString());
  },
  initialize: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await paymentService.initialize(req.user.id, param(req, 'requestId'));
    return sendSuccess(res, data, 'Payment initialized');
  },

  verify: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await paymentService.verify(req.user.id, param(req, 'reference'));
    return sendSuccess(res, data, 'Payment verified');
  },

  mechanicPayments: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await paymentService.listForMechanic(req.user.id);
    return sendSuccess(res, data);
  },

  mechanicPayoutInfo: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await paymentService.getMechanicPayoutInfo(req.user.id);
    return sendSuccess(res, data);
  },

  webhook: async (req: Request, res: Response) => {
    const rawBody = req.body as Buffer;
    const signature = req.headers['x-paystack-signature'];
    const provider = (await import('../payments/payment-provider.impl.js')).getPaymentProvider();
    if (
      !Buffer.isBuffer(rawBody) ||
      !provider.verifyWebhookSignature(
        rawBody,
        typeof signature === 'string' ? signature : undefined,
      )
    ) {
      logger.warn('Rejected Paystack webhook with invalid signature', {
        event: 'subscription.webhook.signature.invalid',
      });
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      data?: Record<string, unknown>;
    };
    if (event.event && event.data) {
      try {
        await subscriptionService.handlePaystackEvent(event.event, event.data);
      } catch (error) {
        logger.warn('Paystack webhook processing failed', {
          event: 'subscription.payment.webhook.received',
          paystackEvent: event.event,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return res.status(200).json({ success: true });
  },
};

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) throw new Error(`Missing ${name}`);
  return value;
}
