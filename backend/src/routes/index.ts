import { Router } from 'express';
import {
  adminController,
  catalogController,
  mechanicController,
  notificationController,
  requestController,
  vehicleController,
} from '../controllers/domain.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireEmailVerification } from '../middleware/requireEmailVerification.js';
import { requireCustomerSubscription } from '../middleware/requireCustomerSubscription.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paymentController } from '../controllers/payment.controller.js';
import { subscriptionController } from '../controllers/subscription.controller.js';
import { chatController } from '../controllers/chat.controller.js';
import { supportController } from '../controllers/support.controller.js';
import { walletController } from '../controllers/wallet.controller.js';
import { settlementController } from '../controllers/settlement.controller.js';
import { financeController } from '../controllers/finance.controller.js';
import { providerPricingController } from '../controllers/provider-pricing.controller.js';
import { walletWriteLimiter } from '../middleware/authRateLimit.js';
import {
  createRequestSchema,
  createVehicleSchema,
  createSupportTicketSchema,
  reportIssueSchema,
  createRatingSchema,
  updateAvailabilitySchema,
  updateLocationSchema,
  updateRequestStatusSchema,
  verifyMechanicSchema,
  sendChatMessageSchema,
} from '../validators/auth.validators.js';
import {
  cancelWithdrawalSchema,
  cashCommitmentSchema,
  confirmWithdrawalSchema,
  failWithdrawalSchema,
  initiateDepositSchema,
  payoutMethodSchema,
  processWithdrawalSchema,
  rejectWithdrawalSchema,
  requestConfirmationSchema,
  requestWithdrawalSchema,
  settlementCreateSchema,
  settlementResolveSchema,
  updatePayoutMethodSchema,
  walletAdjustmentSchema,
} from '../validators/wallet.validators.js';
import {
  adminServiceTypeStatusSchema,
  providerServiceStatusSchema,
  rejectJobQuoteSchema,
  submitJobQuoteSchema,
  upsertProviderServiceSchema,
} from '../validators/provider-pricing.validators.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Road Rescue Ghana API', data: { status: 'ok' } });
});

router.get('/service-types', asyncHandler(catalogController.serviceTypes));
router.get('/subscriptions/plans', asyncHandler(subscriptionController.listPlans));

router.use(authenticate);
router.get(
  '/subscriptions/me',
  authorize('customer'),
  asyncHandler(subscriptionController.current),
);
router.post(
  '/subscriptions/checkout',
  authorize('customer'),
  asyncHandler(subscriptionController.checkout),
);
router.post(
  '/subscriptions/upgrade',
  authorize('customer'),
  asyncHandler(subscriptionController.initializeUpgrade),
);
router.get(
  '/subscriptions/verify/:reference',
  authorize('customer'),
  asyncHandler(subscriptionController.verify),
);
router.post(
  '/subscriptions/downgrade',
  authorize('customer'),
  asyncHandler(subscriptionController.downgradeToFree),
);

router.use(requireEmailVerification);
router.use(requireCustomerSubscription);

router.get('/vehicles', authorize('customer'), asyncHandler(vehicleController.list));
router.post(
  '/vehicles',
  authorize('customer'),
  validateBody(createVehicleSchema),
  asyncHandler(vehicleController.create),
);
router.delete('/vehicles/:id', authorize('customer'), asyncHandler(vehicleController.remove));

router.get('/requests', asyncHandler(requestController.listMine));
router.get(
  '/requests/history',
  authorize('customer'),
  asyncHandler(requestController.listHistory),
);
router.post(
  '/requests',
  authorize('customer'),
  validateBody(createRequestSchema),
  asyncHandler(requestController.create),
);
router.get('/requests/available', authorize('mechanic'), asyncHandler(requestController.available));
router.get('/requests/:id/location', asyncHandler(requestController.getLocation));
router.get('/requests/:id/messages', asyncHandler(chatController.list));
router.post(
  '/requests/:id/messages',
  validateBody(sendChatMessageSchema),
  asyncHandler(chatController.send),
);
router.get('/requests/:id', asyncHandler(requestController.getById));
router.post('/requests/:id/accept', authorize('mechanic'), asyncHandler(requestController.accept));
router.patch(
  '/requests/:id/status',
  authorize('mechanic', 'admin', 'customer'),
  validateBody(updateRequestStatusSchema),
  asyncHandler(requestController.updateStatus),
);
router.post(
  '/requests/:id/request-confirmation',
  authorize('mechanic'),
  validateBody(requestConfirmationSchema),
  asyncHandler(requestController.requestConfirmation),
);
router.post(
  '/requests/:id/confirm-completion',
  authorize('customer'),
  asyncHandler(requestController.confirmCompletion),
);
router.post(
  '/requests/:id/report-issue',
  authorize('customer'),
  validateBody(reportIssueSchema),
  asyncHandler(requestController.reportIssue),
);
router.post(
  '/requests/:id/rating',
  authorize('customer'),
  validateBody(createRatingSchema),
  asyncHandler(requestController.rateCompleted),
);
router.get('/requests/:id/quote', asyncHandler(providerPricingController.getQuote));
router.post(
  '/requests/:id/quote',
  authorize('mechanic'),
  validateBody(submitJobQuoteSchema),
  asyncHandler(providerPricingController.submitQuote),
);
router.post(
  '/requests/:id/quote/accept',
  authorize('customer'),
  asyncHandler(providerPricingController.acceptQuote),
);
router.post(
  '/requests/:id/quote/reject',
  authorize('customer'),
  validateBody(rejectJobQuoteSchema),
  asyncHandler(providerPricingController.rejectQuote),
);

router.post(
  '/payments/initialize/:requestId',
  authorize('customer'),
  asyncHandler(paymentController.initialize),
);
router.get(
  '/payments/verify/:reference',
  authorize('customer'),
  asyncHandler(paymentController.verify),
);
router.get(
  '/requests/:requestId/payment',
  authorize('customer'),
  asyncHandler(paymentController.forRequest),
);
router.get(
  '/mechanics/me/payments',
  authorize('mechanic'),
  asyncHandler(paymentController.mechanicPayments),
);
router.get(
  '/mechanics/me/payout-info',
  authorize('mechanic'),
  asyncHandler(paymentController.mechanicPayoutInfo),
);

router.patch(
  '/mechanics/me/availability',
  authorize('mechanic'),
  validateBody(updateAvailabilitySchema),
  asyncHandler(mechanicController.availability),
);
router.post(
  '/mechanics/me/location',
  authorize('mechanic'),
  validateBody(updateLocationSchema),
  asyncHandler(mechanicController.location),
);
router.get('/mechanics/nearby', asyncHandler(mechanicController.nearby));
router.get(
  '/service-types/:slug/providers',
  asyncHandler(providerPricingController.listProvidersForService),
);
router.get(
  '/mechanics/:id/services',
  asyncHandler(providerPricingController.listPublicForMechanic),
);
router.get('/mechanics/me/earnings', authorize('mechanic'), asyncHandler(mechanicController.earnings));
router.get(
  '/mechanics/me/jobs/history',
  authorize('mechanic'),
  asyncHandler(mechanicController.jobHistory),
);
router.get('/mechanics/:id/reviews', asyncHandler(mechanicController.publicReviews));
router.get('/mechanics/:id', asyncHandler(mechanicController.publicProfile));

router.get('/notifications', asyncHandler(notificationController.list));
router.post('/notifications/:id/read', asyncHandler(notificationController.markRead));
router.post('/notifications/read-all', asyncHandler(notificationController.markAllRead));

router.post(
  '/support/tickets',
  validateBody(createSupportTicketSchema),
  asyncHandler(supportController.create),
);

router.get('/provider/services', authorize('mechanic'), asyncHandler(providerPricingController.listMine));
router.put(
  '/provider/services',
  authorize('mechanic'),
  validateBody(upsertProviderServiceSchema),
  asyncHandler(providerPricingController.upsert),
);
router.patch(
  '/provider/services/:serviceType/status',
  authorize('mechanic'),
  validateBody(providerServiceStatusSchema),
  asyncHandler(providerPricingController.setStatus),
);
router.delete(
  '/provider/services/:serviceType',
  authorize('mechanic'),
  asyncHandler(providerPricingController.remove),
);

router.get('/provider/wallet', authorize('mechanic'), asyncHandler(walletController.getWallet));
router.get(
  '/provider/wallet/transactions',
  authorize('mechanic'),
  asyncHandler(walletController.listTransactions),
);
router.get(
  '/provider/wallet/deposits',
  authorize('mechanic'),
  asyncHandler(walletController.listDeposits),
);
router.post(
  '/provider/wallet/deposit',
  authorize('mechanic'),
  walletWriteLimiter,
  validateBody(initiateDepositSchema),
  asyncHandler(walletController.initiateDeposit),
);
router.get(
  '/provider/wallet/deposit/verify/:reference',
  authorize('mechanic'),
  asyncHandler(walletController.verifyDeposit),
);
router.get(
  '/provider/wallet/payout-methods',
  authorize('mechanic'),
  asyncHandler(walletController.listPayoutMethods),
);
router.post(
  '/provider/wallet/payout-methods',
  authorize('mechanic'),
  walletWriteLimiter,
  validateBody(payoutMethodSchema),
  asyncHandler(walletController.addPayoutMethod),
);
router.patch(
  '/provider/wallet/payout-methods/:id',
  authorize('mechanic'),
  validateBody(updatePayoutMethodSchema),
  asyncHandler(walletController.updatePayoutMethod),
);
router.get(
  '/provider/wallet/withdrawals',
  authorize('mechanic'),
  asyncHandler(walletController.listWithdrawals),
);
router.post(
  '/provider/wallet/withdrawals',
  authorize('mechanic'),
  walletWriteLimiter,
  validateBody(requestWithdrawalSchema),
  asyncHandler(walletController.requestWithdrawal),
);
router.post(
  '/provider/wallet/withdrawals/:id/cancel',
  authorize('mechanic'),
  walletWriteLimiter,
  validateBody(cancelWithdrawalSchema),
  asyncHandler(walletController.cancelWithdrawal),
);

router.get('/admin/dashboard', authorize('admin'), asyncHandler(adminController.dashboard));
router.get(
  '/admin/financial-overview',
  authorize('admin'),
  asyncHandler(walletController.adminOverview),
);
router.get(
  '/admin/withdrawals',
  authorize('admin'),
  asyncHandler(walletController.adminListWithdrawals),
);
router.get(
  '/admin/withdrawals/:id',
  authorize('admin'),
  asyncHandler(walletController.adminGetWithdrawal),
);
router.post(
  '/admin/withdrawals/:id/approve',
  authorize('admin'),
  asyncHandler(walletController.approveWithdrawal),
);
router.post(
  '/admin/withdrawals/:id/reject',
  authorize('admin'),
  validateBody(rejectWithdrawalSchema),
  asyncHandler(walletController.rejectWithdrawal),
);
router.post(
  '/admin/withdrawals/:id/process',
  authorize('admin'),
  validateBody(processWithdrawalSchema),
  asyncHandler(walletController.processWithdrawal),
);
router.post(
  '/admin/withdrawals/:id/confirm',
  authorize('admin'),
  validateBody(confirmWithdrawalSchema),
  asyncHandler(walletController.confirmWithdrawal),
);
router.post(
  '/admin/withdrawals/:id/fail',
  authorize('admin'),
  validateBody(failWithdrawalSchema),
  asyncHandler(walletController.failWithdrawal),
);
router.post(
  '/admin/withdrawals/:id/cancel',
  authorize('admin'),
  validateBody(cancelWithdrawalSchema),
  asyncHandler(walletController.adminCancelWithdrawal),
);
router.get(
  '/admin/payout-methods/unverified',
  authorize('admin'),
  asyncHandler(walletController.listUnverifiedPayoutMethods),
);
router.post(
  '/admin/payout-methods/:id/verify',
  authorize('admin'),
  asyncHandler(walletController.verifyPayoutMethod),
);
router.get(
  '/admin/settlements/awaiting',
  authorize('admin'),
  asyncHandler(settlementController.awaiting),
);
router.get('/admin/settlements', authorize('admin'), asyncHandler(settlementController.list));
router.get('/admin/settlements/:id', authorize('admin'), asyncHandler(settlementController.get));
router.post(
  '/admin/settlements',
  authorize('admin'),
  validateBody(settlementCreateSchema),
  asyncHandler(settlementController.create),
);
router.post(
  '/admin/settlements/:id/confirm',
  authorize('admin'),
  asyncHandler(settlementController.confirm),
);
router.post(
  '/admin/settlements/:id/resolve',
  authorize('admin'),
  validateBody(settlementResolveSchema),
  asyncHandler(settlementController.resolve),
);
router.get('/admin/finance/summary', authorize('admin'), asyncHandler(financeController.summary));
router.get(
  '/admin/finance/transactions',
  authorize('admin'),
  asyncHandler(financeController.transactions),
);
router.get(
  '/admin/cash-reconciliation',
  authorize('admin'),
  asyncHandler(settlementController.cash),
);
router.post(
  '/admin/cash-commitments',
  authorize('admin'),
  validateBody(cashCommitmentSchema),
  asyncHandler(settlementController.commitment),
);
router.get(
  '/admin/financial-reports',
  authorize('admin'),
  asyncHandler(settlementController.reports),
);
router.get(
  '/admin/providers/:id/financial-account',
  authorize('admin'),
  asyncHandler(walletController.adminProviderAccount),
);
router.post(
  '/admin/providers/:id/adjustments',
  authorize('admin'),
  validateBody(walletAdjustmentSchema),
  asyncHandler(walletController.adjust),
);
router.patch(
  '/admin/mechanics/:id/verification',
  authorize('admin'),
  validateBody(verifyMechanicSchema),
  asyncHandler(adminController.verifyMechanic),
);
router.get(
  '/admin/service-types',
  authorize('admin'),
  asyncHandler(providerPricingController.adminCatalogue),
);
router.patch(
  '/admin/service-types/:slug',
  authorize('admin'),
  validateBody(adminServiceTypeStatusSchema),
  asyncHandler(providerPricingController.adminSetCatalogue),
);
router.get(
  '/admin/providers/:id/services',
  authorize('admin'),
  asyncHandler(providerPricingController.adminProviderServices),
);

export default router;
