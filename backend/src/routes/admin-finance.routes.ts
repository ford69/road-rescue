import { Router } from 'express';
import { financeController } from '../controllers/finance.controller.js';
import { settlementController } from '../controllers/settlement.controller.js';
import { walletController } from '../controllers/wallet.controller.js';
import { authorize } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  cancelWithdrawalSchema,
  cashCommitmentSchema,
  confirmWithdrawalSchema,
  failWithdrawalSchema,
  processWithdrawalSchema,
  rejectWithdrawalSchema,
  settlementCreateSchema,
  settlementResolveSchema,
  walletAdjustmentSchema,
} from '../validators/wallet.validators.js';

/**
 * Admin finance routes, mounted at `/admin` on the API router and at
 * `/api/admin` on the app so a stale `/api` router cannot 404 them.
 */
const router = Router();

router.use(authorize('admin'));

router.get('/finance/summary', asyncHandler(financeController.summary));
router.get('/finance/transactions', asyncHandler(financeController.transactions));
router.get('/financial-overview', asyncHandler(walletController.adminOverview));
router.get('/financial-reports', asyncHandler(settlementController.reports));
router.get('/cash-reconciliation', asyncHandler(settlementController.cash));
router.post(
  '/cash-commitments',
  validateBody(cashCommitmentSchema),
  asyncHandler(settlementController.commitment),
);

router.get('/withdrawals', asyncHandler(walletController.adminListWithdrawals));
router.get('/withdrawals/:id', asyncHandler(walletController.adminGetWithdrawal));
router.post('/withdrawals/:id/approve', asyncHandler(walletController.approveWithdrawal));
router.post(
  '/withdrawals/:id/reject',
  validateBody(rejectWithdrawalSchema),
  asyncHandler(walletController.rejectWithdrawal),
);
router.post(
  '/withdrawals/:id/process',
  validateBody(processWithdrawalSchema),
  asyncHandler(walletController.processWithdrawal),
);
router.post(
  '/withdrawals/:id/confirm',
  validateBody(confirmWithdrawalSchema),
  asyncHandler(walletController.confirmWithdrawal),
);
router.post(
  '/withdrawals/:id/fail',
  validateBody(failWithdrawalSchema),
  asyncHandler(walletController.failWithdrawal),
);
router.post(
  '/withdrawals/:id/cancel',
  validateBody(cancelWithdrawalSchema),
  asyncHandler(walletController.adminCancelWithdrawal),
);

router.get('/payout-methods/unverified', asyncHandler(walletController.listUnverifiedPayoutMethods));
router.post('/payout-methods/:id/verify', asyncHandler(walletController.verifyPayoutMethod));

router.get('/settlements/awaiting', asyncHandler(settlementController.awaiting));
router.get('/settlements', asyncHandler(settlementController.list));
router.get('/settlements/:id', asyncHandler(settlementController.get));
router.post(
  '/settlements',
  validateBody(settlementCreateSchema),
  asyncHandler(settlementController.create),
);
router.post('/settlements/:id/confirm', asyncHandler(settlementController.confirm));
router.post(
  '/settlements/:id/resolve',
  validateBody(settlementResolveSchema),
  asyncHandler(settlementController.resolve),
);

router.get('/providers/:id/financial-account', asyncHandler(walletController.adminProviderAccount));
router.post(
  '/providers/:id/adjustments',
  validateBody(walletAdjustmentSchema),
  asyncHandler(walletController.adjust),
);

export default router;
