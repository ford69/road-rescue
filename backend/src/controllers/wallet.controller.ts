import type { Request, Response } from 'express';
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

export const walletController = {
  getWallet: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.getWalletForUser(user.id);
    return sendSuccess(res, data);
  },

  listTransactions: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.listTransactions(user.id, {
      page: req.query.page,
      limit: req.query.limit,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
    });
    return sendSuccess(res, data);
  },

  listDeposits: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.listDeposits(user.id, req.query);
    return sendSuccess(res, data);
  },

  initiateDeposit: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.initiateDeposit(user.id, Number(req.body.amountGhs));
    return sendSuccess(res, data, 'Deposit initialized');
  },

  verifyDeposit: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await walletService.verifyDeposit(user.id, param(req, 'reference'));
    return sendSuccess(res, {
      wallet: result?.wallet,
      status: result?.deposit.status,
      duplicate: result?.duplicate ?? false,
      amountGhs: result ? result.wallet.availableGhs : undefined,
    }, 'Deposit verified');
  },

  listPayoutMethods: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.listPayoutMethods(user.id);
    return sendSuccess(res, data);
  },

  addPayoutMethod: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.addPayoutMethod(user.id, req.body);
    return sendSuccess(res, data, 'Payout destination saved', 201);
  },

  updatePayoutMethod: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.updatePayoutMethod(user.id, param(req, 'id'), req.body);
    return sendSuccess(res, data, 'Payout destination updated');
  },

  requestWithdrawal: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.requestWithdrawal(
      user.id,
      Number(req.body.amountGhs),
      String(req.body.payoutMethodId),
      req.body.sourceType === 'service_earnings' ? 'service_earnings' : 'deposit_refund',
    );
    return sendSuccess(res, data, 'Withdrawal submitted', 201);
  },

  cancelWithdrawal: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.cancelOwnWithdrawal(
      user.id,
      param(req, 'id'),
      String(req.body.reason ?? 'Cancelled by provider'),
    );
    return sendSuccess(res, data, 'Withdrawal cancelled');
  },

  listWithdrawals: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.listWithdrawals(user.id, req.query);
    return sendSuccess(res, data);
  },

  adminOverview: async (_req: Request, res: Response) => {
    const data = await walletService.overview();
    return sendSuccess(res, data);
  },

  adminListWithdrawals: async (req: Request, res: Response) => {
    const data = await walletService.adminListWithdrawals({
      page: req.query.page,
      limit: req.query.limit,
      q: req.query.q,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return sendSuccess(res, data);
  },

  adminGetWithdrawal: async (req: Request, res: Response) => {
    const data = await walletService.adminGetWithdrawal(param(req, 'id'));
    return sendSuccess(res, data);
  },

  approveWithdrawal: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.approveWithdrawal(user.id, param(req, 'id'));
    return sendSuccess(res, data, 'Withdrawal approved');
  },

  rejectWithdrawal: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.rejectWithdrawal(user.id, param(req, 'id'), req.body.reason);
    return sendSuccess(res, data, 'Withdrawal rejected');
  },

  processWithdrawal: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.processWithdrawal(
      user.id,
      param(req, 'id'),
      req.body.payoutMethodUsed,
    );
    return sendSuccess(res, data, 'Payout processing recorded');
  },

  confirmWithdrawal: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.confirmWithdrawal(user.id, param(req, 'id'), {
      payoutReference: req.body.payoutReference,
      amountPaidGhs: req.body.amountPaidGhs,
      payoutDate: req.body.payoutDate,
      proofUrl: req.body.proofUrl,
      destinationNote: req.body.destinationNote,
    });
    return sendSuccess(res, data, 'Payout confirmed');
  },

  adminCancelWithdrawal: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.cancelWithdrawal(
      user.id,
      param(req, 'id'),
      String(req.body.reason ?? 'Cancelled by administrator'),
      true,
    );
    return sendSuccess(res, data, 'Withdrawal cancelled');
  },

  verifyPayoutMethod: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.verifyPayoutMethod(user.id, param(req, 'id'));
    return sendSuccess(res, data, 'Payout destination verified');
  },

  listUnverifiedPayoutMethods: async (_req: Request, res: Response) => {
    const data = await walletService.listUnverifiedPayoutMethods();
    return sendSuccess(res, data);
  },

  failWithdrawal: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.failWithdrawal(user.id, param(req, 'id'), req.body.reason);
    return sendSuccess(res, data, 'Payout marked failed');
  },

  adminProviderAccount: async (req: Request, res: Response) => {
    const data = await walletService.adminMechanicAccount(param(req, 'id'));
    return sendSuccess(res, data);
  },

  adjust: async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = await walletService.adjust(user.id, param(req, 'id'), {
      amountGhs: Number(req.body.amountGhs),
      reason: String(req.body.reason),
      reference: req.body.reference,
    });
    return sendSuccess(res, data, 'Adjustment recorded');
  },
};
