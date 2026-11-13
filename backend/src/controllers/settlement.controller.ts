import type { Request, Response } from 'express';
import { corporateCashService } from '../services/corporate-cash.service.js';
import { settlementService } from '../services/settlement.service.js';
import { walletService } from '../services/wallet.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) {
    throw new ValidationError(`Missing route parameter: ${name}`);
  }
  return value;
}

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

function settlementMessage(status: string): string {
  if (status === 'confirmed') return 'Settlement confirmed';
  if (status === 'discrepancy') return 'Amount does not match. Settlement flagged for review';
  return 'Settlement draft saved';
}

export const settlementController = {
  awaiting: async (req: Request, res: Response) => {
    const data = await settlementService.listAwaiting({
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    return sendSuccess(res, data);
  },

  list: async (req: Request, res: Response) => {
    const data = await settlementService.list({
      page: req.query.page,
      limit: req.query.limit,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return sendSuccess(res, data);
  },

  get: async (req: Request, res: Response) => {
    const data = await settlementService.getById(param(req, 'id'));
    return sendSuccess(res, data);
  },

  create: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await settlementService.create(user.id, req.body);
    return sendSuccess(res, data, settlementMessage(data.status), 201);
  },

  confirm: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await settlementService.confirm(user.id, param(req, 'id'));
    return sendSuccess(res, data, settlementMessage(data.status));
  },

  resolve: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await settlementService.resolve(user.id, param(req, 'id'), req.body);
    return sendSuccess(res, data, settlementMessage(data.status));
  },

  cash: async (_req: Request, res: Response) => {
    const [snapshot, activity] = await Promise.all([
      corporateCashService.snapshot(),
      corporateCashService.recentActivity(40),
    ]);
    return sendSuccess(res, { ...snapshot, activity });
  },

  commitment: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await corporateCashService.recordCommitment({
      adminUserId: user.id,
      amountGhs: Number(req.body.amountGhs),
      reason: String(req.body.reason),
      release: Boolean(req.body.release),
      reference: req.body.reference,
    });
    return sendSuccess(res, data, 'Cash commitment recorded');
  },

  reports: async (_req: Request, res: Response) => {
    const [overview, cash, awaiting] = await Promise.all([
      walletService.overview(),
      corporateCashService.snapshot(),
      settlementService.listAwaiting({}),
    ]);
    return sendSuccess(res, {
      overview,
      cash,
      awaitingSettlementCount: awaiting.items.length,
    });
  },
};
