import { z } from 'zod';

export const initiateDepositSchema = z.object({
  amountGhs: z.coerce.number().positive('Enter a valid deposit amount'),
});

export const requestWithdrawalSchema = z.object({
  amountGhs: z.coerce.number().positive('Enter a valid withdrawal amount'),
  payoutMethodId: z.string().min(1, 'Choose a payout destination'),
  sourceType: z.enum(['service_earnings', 'deposit_refund']).optional(),
});

export const payoutMethodSchema = z.object({
  kind: z.enum(['bank', 'mobile_money']),
  label: z.string().trim().min(2).max(80),
  accountName: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().min(6).max(32),
  bankCode: z.string().trim().max(20).optional(),
  bankName: z.string().trim().max(80).optional(),
  network: z.enum(['mtn', 'vodafone', 'airteltigo']).optional(),
  isDefault: z.boolean().optional(),
});

export const updatePayoutMethodSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const rejectWithdrawalSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const processWithdrawalSchema = z.object({
  payoutMethodUsed: z.string().trim().min(2).max(80),
});

export const confirmWithdrawalSchema = z.object({
  payoutReference: z.string().trim().min(3).max(80),
  amountPaidGhs: z.coerce.number().positive().optional(),
  payoutDate: z.string().trim().min(8).max(40).optional(),
  proofUrl: z.string().trim().url().max(500).optional(),
  destinationNote: z.string().trim().max(200).optional(),
});

export const cancelWithdrawalSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const settlementCreateSchema = z.object({
  settlementReference: z.string().trim().min(3).max(80),
  amountReceivedGhs: z.coerce.number().positive('Enter the amount received in the bank account'),
  paystackFeesGhs: z.coerce.number().min(0, 'Paystack fees cannot be negative').optional(),
  settlementDate: z.string().trim().min(8).max(40),
  bankReference: z.string().trim().max(80).optional(),
  paystackReference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  paymentIds: z.array(z.string().min(1)).optional(),
  depositIds: z.array(z.string().min(1)).optional(),
  confirm: z.boolean().optional(),
});

export const settlementResolveSchema = z.object({
  amountReceivedGhs: z.coerce.number().positive().optional(),
  paystackFeesGhs: z.coerce.number().min(0).optional(),
  bankReference: z.string().trim().max(80).optional(),
  acceptDifference: z.boolean().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const cashCommitmentSchema = z.object({
  amountGhs: z.coerce.number().positive('Enter a valid amount'),
  reason: z.string().trim().min(5).max(500),
  release: z.boolean().optional(),
  reference: z.string().trim().min(3).max(80).optional(),
});

export const failWithdrawalSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const walletAdjustmentSchema = z.object({
  amountGhs: z.coerce.number().refine((value) => value !== 0, 'Adjustment amount cannot be zero'),
  reason: z.string().trim().min(5).max(500),
  reference: z.string().trim().min(3).max(80).optional(),
});

export const requestConfirmationSchema = z.object({
  quotedPrice: z.coerce.number().min(0).max(1_000_000).optional(),
});
