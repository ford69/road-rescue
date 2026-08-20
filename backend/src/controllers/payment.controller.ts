import type { Request, Response } from 'express';
import { paymentService } from '../services/payment.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../utils/errors.js';
import { verifyPaystackSignature } from '../payments/paystack.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) throw new Error(`Missing ${name}`);
  return value;
}

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

  webhook: async (req: Request, res: Response) => {
    const rawBody = req.body as Buffer;
    const signature = req.headers['x-paystack-signature'];
    if (
      !Buffer.isBuffer(rawBody) ||
      !verifyPaystackSignature(
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
      await paymentService.handleChargeSuccess(event.data);
    }
    return res.status(200).json({ success: true });
  },
};
