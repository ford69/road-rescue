import type { Request, Response } from 'express';
import { paymentService } from '../services/payment.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../utils/errors.js';

export const paymentController = {
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
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      data?: Parameters<typeof paymentService.handleChargeSuccess>[0];
    };
    if (event.event === 'charge.success' && event.data) {
      try {
        await paymentService.handleChargeSuccess(event.data);
      } catch {
        // Idempotent duplicate webhooks should not fail the provider callback.
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
