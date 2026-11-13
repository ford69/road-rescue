import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { notificationRepository } from '../repositories/misc.repository.js';
import { paymentRepository } from '../repositories/misc.repository.js';
import {
  depositRepository,
  ledgerRepository,
  payoutMethodRepository,
  walletAuditRepository,
  walletRepository,
  withdrawalRepository,
} from '../repositories/wallet.repository.js';
import { getPaymentProvider } from '../payments/payment-provider.impl.js';
import type { IProviderWallet } from '../models/ProviderWallet.js';
import type { WalletLedgerSourceType, WalletLedgerType } from '../models/WalletLedgerEntry.js';
import type { IPayoutMethod } from '../models/PayoutMethod.js';
import type { IWalletWithdrawal, WalletWithdrawalSource } from '../models/WalletWithdrawal.js';
import type { IRescueRequest } from '../models/RescueRequest.js';
import { corporateCashService } from './corporate-cash.service.js';
import { commissionPesewas, ghsToPesewas, pesewasToGhs } from '../utils/money.js';
import { isDuplicateKeyError } from '../utils/mongoErrors.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import {
  escapeRegex,
  paginationMeta,
  parsePagination,
  type PaginationQuery,
} from '../utils/pagination.js';
import { refId } from '../utils/objectId.js';

export const WALLET_DEPOSIT_PREFIX = 'RR_PWAL_';

export function isWalletDepositReference(reference?: string): boolean {
  return typeof reference === 'string' && reference.startsWith(WALLET_DEPOSIT_PREFIX);
}

function newReference(prefix: string): string {
  return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
}

function last4(value: string): string {
  const digits = value.replace(/\s+/g, '');
  return digits.slice(-4).padStart(Math.min(4, digits.length), '•');
}

function maskPayout(method: IPayoutMethod) {
  return {
    id: method._id.toString(),
    kind: method.kind,
    label: method.label,
    accountName: method.accountName,
    accountLast4: last4(method.accountNumber),
    bankName: method.bankName,
    bankCode: method.bankCode,
    network: method.network,
    verified: method.verified,
    isDefault: method.isDefault,
  };
}

function serializeWallet(wallet: IProviderWallet) {
  const available = wallet.availablePesewas ?? 0;
  const pending = wallet.pendingPesewas ?? 0;
  return {
    currency: 'GHS' as const,
    availableGhs: pesewasToGhs(available),
    pendingSettlementGhs: pesewasToGhs(pending),
    reservedGhs: pesewasToGhs(wallet.reservedPesewas),
    paidGhs: pesewasToGhs(wallet.totalWithdrawnPesewas),
    depositAvailableGhs: pesewasToGhs(available),
    totalDepositedGhs: pesewasToGhs(wallet.totalDepositedPesewas),
    totalCommissionGhs: pesewasToGhs(wallet.totalCommissionPesewas),
    totalEarnedGhs: pesewasToGhs(wallet.totalEarnedPesewas ?? 0),
    totalWithdrawnGhs: pesewasToGhs(wallet.totalWithdrawnPesewas),
    totalReversedGhs: pesewasToGhs(wallet.totalReversedPesewas),
    availablePesewas: available,
    pendingPesewas: pending,
    reservedPesewas: wallet.reservedPesewas,
    depositAvailablePesewas: available,
    commissionPercent: env.PROVIDER_COMMISSION_PERCENT,
    minDepositGhs: env.PROVIDER_WALLET_MIN_DEPOSIT_GHS,
    minWithdrawalGhs: env.PROVIDER_WALLET_MIN_WITHDRAWAL_GHS,
    maxWithdrawalGhs: env.PROVIDER_WALLET_MAX_WITHDRAWAL_GHS,
    minAvailableGhs: env.PROVIDER_WALLET_MIN_AVAILABLE_GHS,
  };
}

async function mechanicForUser(userId: string) {
  const mechanic = await mechanicRepository.findByUserId(userId);
  if (!mechanic) throw new NotFoundError('Provider profile not found');
  return mechanic;
}

async function notifyOnce(
  userId: unknown,
  key: string,
  already: boolean,
  mark: () => Promise<unknown>,
  payload: { title: string; body: string; type: 'success' | 'info' | 'warning' | 'critical' },
) {
  if (already || !userId) return;
  await notificationRepository.create({
    title: payload.title,
    body: payload.body,
    recipient: userId as never,
    type: payload.type,
    meta: { walletEvent: key },
  });
  await mark();
}

async function postLedger(input: {
  mechanicId: string;
  type: WalletLedgerType;
  amountPesewas: number;
  description: string;
  idempotencyKey: string;
  sourceType?: WalletLedgerSourceType;
  requestId?: string;
  withdrawalId?: string;
  depositId?: string;
  paymentId?: string;
  settlementId?: string;
  paystackReference?: string;
  actorType?: 'system' | 'provider' | 'admin';
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await ledgerRepository.create({
      reference: newReference('RR_LED_'),
      mechanic: input.mechanicId as never,
      type: input.type,
      sourceType: input.sourceType,
      amountPesewas: input.amountPesewas,
      status: 'completed',
      description: input.description,
      request: input.requestId as never,
      withdrawal: input.withdrawalId as never,
      deposit: input.depositId as never,
      payment: input.paymentId as never,
      settlement: input.settlementId as never,
      paystackReference: input.paystackReference,
      idempotencyKey: input.idempotencyKey,
      actorType: input.actorType ?? 'system',
      actorUser: input.actorUserId as never,
      metadata: input.metadata,
    });
    return { created: true };
  } catch (error) {
    if (isDuplicateKeyError(error)) return { created: false };
    throw error;
  }
}

async function creditAvailable(
  mechanicId: string,
  amountPesewas: number,
  extras: { totalDepositedPesewas?: number; totalReversedPesewas?: number },
) {
  const updated = await walletRepository.incrementIf(mechanicId, {}, {
    availablePesewas: amountPesewas,
    ...extras,
  });
  if (!updated) throw new NotFoundError('Provider wallet not found');
  return updated;
}

async function reserveAvailable(mechanicId: string, amountPesewas: number) {
  const updated = await walletRepository.incrementIf(
    mechanicId,
    { availablePesewas: { $gte: amountPesewas } },
    { availablePesewas: -amountPesewas, reservedPesewas: amountPesewas },
  );
  if (!updated) {
    throw new ValidationError('Insufficient available balance');
  }
  return updated;
}

async function releaseReserved(mechanicId: string, amountPesewas: number) {
  const updated = await walletRepository.incrementIf(
    mechanicId,
    { reservedPesewas: { $gte: amountPesewas } },
    { availablePesewas: amountPesewas, reservedPesewas: -amountPesewas },
  );
  if (!updated) throw new ConflictError('Reserved funds are no longer available to release');
  return updated;
}

async function captureReserved(
  mechanicId: string,
  amountPesewas: number,
  extras: { totalCommissionPesewas?: number; totalWithdrawnPesewas?: number },
) {
  const updated = await walletRepository.incrementIf(
    mechanicId,
    { reservedPesewas: { $gte: amountPesewas } },
    { reservedPesewas: -amountPesewas, ...extras },
  );
  if (!updated) throw new ConflictError('Reserved funds are no longer available to capture');
  return updated;
}

async function reserveEarnings(mechanicId: string, amountPesewas: number) {
  const updated = await walletRepository.incrementIf(
    mechanicId,
    { earningsAvailablePesewas: { $gte: amountPesewas } },
    { earningsAvailablePesewas: -amountPesewas, reservedPesewas: amountPesewas },
  );
  if (!updated) {
    throw new ValidationError('Insufficient settled service earnings for this withdrawal');
  }
  return updated;
}

async function releaseEarnings(mechanicId: string, amountPesewas: number) {
  const updated = await walletRepository.incrementIf(
    mechanicId,
    { reservedPesewas: { $gte: amountPesewas } },
    { earningsAvailablePesewas: amountPesewas, reservedPesewas: -amountPesewas },
  );
  if (!updated) throw new ConflictError('Reserved earnings are no longer available to release');
  return updated;
}

async function assertWithdrawable(
  mechanicId: string,
  amountPesewas: number,
  sourceType: WalletWithdrawalSource,
) {
  const wallet = await walletRepository.ensure(mechanicId);
  if (sourceType === 'service_earnings') {
    if ((wallet.earningsAvailablePesewas ?? 0) < amountPesewas) {
      throw new ValidationError('Insufficient settled service earnings for this withdrawal');
    }
    return;
  }
  if ((wallet.availablePesewas ?? 0) < amountPesewas) {
    throw new ValidationError('Insufficient available balance');
  }
}

async function reserveForWithdrawal(
  mechanicId: string,
  amountPesewas: number,
  sourceType: WalletWithdrawalSource,
) {
  if (sourceType === 'service_earnings') {
    return reserveEarnings(mechanicId, amountPesewas);
  }
  return reserveAvailable(mechanicId, amountPesewas);
}

async function withdrawalBuckets(mechanicId: string) {
  const [pending, inPayout] = await Promise.all([
    withdrawalRepository.sumAmount({ mechanic: mechanicId, status: 'pending' }),
    withdrawalRepository.sumAmount({
      mechanic: mechanicId,
      status: { $in: ['approved', 'processing'] },
    }),
  ]);
  return {
    pendingWithdrawalGhs: pesewasToGhs(pending[0]?.total ?? 0),
    payoutInProgressGhs: pesewasToGhs(inPayout[0]?.total ?? 0),
  };
}

export const walletService = {
  async getWalletForUser(userId: string) {
    const mechanic = await mechanicForUser(userId);
    const wallet = await walletRepository.ensure(mechanic._id.toString());
    return {
      ...serializeWallet(wallet),
      ...(await withdrawalBuckets(mechanic._id.toString())),
    };
  },

  async getWalletForMechanicId(mechanicId: string) {
    const wallet = await walletRepository.ensure(mechanicId);
    return {
      ...serializeWallet(wallet),
      ...(await withdrawalBuckets(mechanicId)),
    };
  },

  async listTransactions(userId: string, query: PaginationQuery & { type?: string }) {
    const mechanic = await mechanicForUser(userId);
    const paging = parsePagination(query);
    const type = typeof query.type === 'string' ? query.type : undefined;
    const [items, total] = await Promise.all([
      ledgerRepository.findByMechanic(mechanic._id.toString(), {
        type,
        skip: paging.skip,
        limit: paging.limit,
      }),
      ledgerRepository.countByMechanic(mechanic._id.toString(), type),
    ]);
    return {
      items: items.map((entry) => ({
        id: entry._id.toString(),
        reference: entry.reference,
        type: entry.type,
        description: entry.description,
        amountGhs: pesewasToGhs(entry.amountPesewas),
        status: entry.status,
        requestId: entry.request ? String(entry.request) : undefined,
        paystackReference: entry.paystackReference,
        createdAt: entry.createdAt,
      })),
      ...paginationMeta(total, paging.page, paging.limit),
    };
  },

  async initiateDeposit(userId: string, amountGhs: number) {
    if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
      throw new ValidationError('Enter a valid deposit amount');
    }
    if (amountGhs < env.PROVIDER_WALLET_MIN_DEPOSIT_GHS) {
      throw new ValidationError(`Minimum deposit is ₵${env.PROVIDER_WALLET_MIN_DEPOSIT_GHS}`);
    }
    const mechanic = await mechanicForUser(userId);
    const user = await userRepository.findById(userId);
    if (!user?.email) throw new ValidationError('Your account needs an email to deposit');
    const provider = getPaymentProvider();
    if (!provider.isConfigured()) {
      throw new ValidationError('Paystack is not configured for deposits');
    }

    const amountPesewas = ghsToPesewas(amountGhs);
    const reference = newReference(WALLET_DEPOSIT_PREFIX);
    await walletRepository.ensure(mechanic._id.toString());

    const initialized = await provider.initializePayment({
      email: user.email,
      amountGhs: pesewasToGhs(amountPesewas),
      reference,
      callbackUrl: `${env.PRIMARY_CLIENT_ORIGIN}/mechanic/wallet`,
      metadata: {
        kind: 'provider_wallet_deposit',
        mechanicId: mechanic._id.toString(),
        userId,
      },
      platformFeePercent: 100,
    });

    await depositRepository.create({
      reference,
      mechanic: mechanic._id,
      amountPesewas,
      status: 'pending',
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode,
      paystackReference: initialized.reference,
    });

    return {
      reference: initialized.reference,
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode,
      amountGhs: pesewasToGhs(amountPesewas),
    };
  },

  async verifyDeposit(userId: string, reference: string) {
    const mechanic = await mechanicForUser(userId);
    const deposit = await depositRepository.findByReference(reference);
    if (!deposit) throw new NotFoundError('Deposit not found');
    if (refId(deposit.mechanic) !== mechanic._id.toString()) {
      throw new ForbiddenError('You cannot verify another provider’s deposit');
    }
    return this.fulfillVerifiedDeposit(deposit.paystackReference);
  },

  async fulfillVerifiedDeposit(reference: string) {
    const deposit = await depositRepository.findByReference(reference);
    if (!deposit) return null;
    if (deposit.credited && deposit.status === 'completed') {
      const wallet = await walletRepository.ensure(refId(deposit.mechanic));
      return { deposit, wallet: serializeWallet(wallet), duplicate: true };
    }

    const provider = getPaymentProvider();
    const verified = await provider.verifyPayment(deposit.paystackReference);
    const mechanicId = refId(deposit.mechanic);
    const mechanic = await mechanicRepository.findById(mechanicId);

    if (verified.currency && verified.currency.toUpperCase() !== 'GHS') {
      deposit.status = 'failed';
      await deposit.save();
      await notifyOnce(
        mechanic?.userId,
        'deposit_failed',
        deposit.notified,
        async () => {
          deposit.notified = true;
          await deposit.save();
        },
        {
          title: 'Deposit failed',
          body: 'Paystack reported a currency mismatch for your wallet deposit.',
          type: 'warning',
        },
      );
      throw new ValidationError('Deposit currency must be GHS');
    }

    if (verified.amountPesewas !== deposit.amountPesewas) {
      deposit.status = 'failed';
      await deposit.save();
      throw new ValidationError('Deposit amount does not match the Paystack charge');
    }

    if (verified.status !== 'success') {
      deposit.status = verified.status === 'abandoned' ? 'abandoned' : 'failed';
      await deposit.save();
      await notifyOnce(
        mechanic?.userId,
        'deposit_failed',
        deposit.notified,
        async () => {
          deposit.notified = true;
          await deposit.save();
        },
        {
          title: 'Deposit unsuccessful',
          body: `Your ₵${pesewasToGhs(deposit.amountPesewas).toFixed(2)} deposit was not completed.`,
          type: 'warning',
        },
      );
      return { deposit, wallet: serializeWallet(await walletRepository.ensure(mechanicId)), duplicate: false };
    }

    const posted = await postLedger({
      mechanicId,
      type: 'deposit',
      amountPesewas: deposit.amountPesewas,
      description: `Wallet deposit ₵${pesewasToGhs(deposit.amountPesewas).toFixed(2)}`,
      idempotencyKey: `deposit_credit:${deposit.paystackReference}`,
      depositId: deposit._id.toString(),
      paystackReference: deposit.paystackReference,
    });

    if (posted.created) {
      await creditAvailable(mechanicId, deposit.amountPesewas, {
        totalDepositedPesewas: deposit.amountPesewas,
      });
    }

    deposit.status = 'completed';
    deposit.credited = true;
    deposit.channel = verified.channel;
    deposit.paidAt = verified.paid_at ? new Date(verified.paid_at) : new Date();
    await deposit.save();

    await notifyOnce(
      mechanic?.userId,
      'deposit_success',
      deposit.notified,
      async () => {
        deposit.notified = true;
        await deposit.save();
      },
      {
        title: 'Deposit received',
        body: `₵${pesewasToGhs(deposit.amountPesewas).toFixed(2)} was added to your Road Rescue wallet.`,
        type: 'success',
      },
    );

    return {
      deposit,
      wallet: serializeWallet(await walletRepository.ensure(mechanicId)),
      duplicate: !posted.created,
    };
  },

  async listDeposits(userId: string, query: PaginationQuery) {
    const mechanic = await mechanicForUser(userId);
    const paging = parsePagination(query);
    const [items, total] = await Promise.all([
      depositRepository.findByMechanic(mechanic._id.toString(), paging.skip, paging.limit),
      depositRepository.countByMechanic(mechanic._id.toString()),
    ]);
    return {
      items: items.map((item) => ({
        id: item._id.toString(),
        reference: item.reference,
        amountGhs: pesewasToGhs(item.amountPesewas),
        status: item.status,
        channel: item.channel,
        createdAt: item.createdAt,
        paidAt: item.paidAt,
      })),
      ...paginationMeta(total, paging.page, paging.limit),
    };
  },

  async assertCanAcceptJob(userId: string) {
    const mechanic = await mechanicForUser(userId);
    const wallet = await walletRepository.ensure(mechanic._id.toString());
    const minPesewas = ghsToPesewas(env.PROVIDER_WALLET_MIN_AVAILABLE_GHS);
    if (wallet.availablePesewas < minPesewas) {
      throw new ValidationError(
        `Deposit at least ₵${env.PROVIDER_WALLET_MIN_AVAILABLE_GHS} before accepting jobs. Available: ₵${pesewasToGhs(wallet.availablePesewas).toFixed(2)}.`,
      );
    }
    return wallet;
  },

  async syncCommissionHold(userId: string, request: IRescueRequest) {
    if (!request.mechanic) return request;
    const mechanicId = refId(request.mechanic);
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic || mechanic._id.toString() !== mechanicId) {
      throw new ForbiddenError('You are not assigned to this request');
    }
    return this.syncCommissionHoldForRequest(request);
  },

  async syncCommissionHoldForRequest(request: IRescueRequest) {
    if (!request.mechanic) return request;
    if (request.commissionCapturedPesewas > 0) return request;
    const mechanicId = refId(request.mechanic);
    await walletRepository.ensure(mechanicId);
    const needed = commissionPesewas(ghsToPesewas(request.quotedPrice), env.PROVIDER_COMMISSION_PERCENT);
    const current = request.commissionHoldPesewas ?? 0;
    if (needed === current) return request;

    if (needed > current) {
      const delta = needed - current;
      const posted = await postLedger({
        mechanicId,
        type: 'commission_reservation',
        amountPesewas: delta,
        description: `Commission hold for job ${request._id.toString()}`,
        idempotencyKey: `commission_reservation:${request._id.toString()}:${needed}`,
        requestId: request._id.toString(),
      });
      if (posted.created) {
        await reserveAvailable(mechanicId, delta);
      }
    } else {
      const delta = current - needed;
      const posted = await postLedger({
        mechanicId,
        type: 'commission_release',
        amountPesewas: delta,
        description: `Commission hold reduced for job ${request._id.toString()}`,
        idempotencyKey: `commission_release:${request._id.toString()}:${current}:${needed}`,
        requestId: request._id.toString(),
      });
      if (posted.created) {
        await releaseReserved(mechanicId, delta);
      }
    }

    request.commissionHoldPesewas = needed;
    await request.save();
    return request;
  },

  async captureCommission(request: IRescueRequest) {
    if (!request.mechanic) return;
    if (request.commissionCapturedPesewas > 0) return;
    const existingPayment = await paymentRepository.findByRequest(request._id.toString());
    if (existingPayment?.entitlementCredited) return;
    const mechanicId = refId(request.mechanic);
    const amount = commissionPesewas(ghsToPesewas(request.quotedPrice), env.PROVIDER_COMMISSION_PERCENT);
    if (amount <= 0) {
      request.commissionCapturedPesewas = 0;
      await request.save();
      return;
    }

    await this.syncCommissionHoldForRequest(request);
    const posted = await postLedger({
      mechanicId,
      type: 'commission_deduction',
      amountPesewas: amount,
      description: `${env.PROVIDER_COMMISSION_PERCENT}% platform commission on ₵${Number(request.quotedPrice).toFixed(2)}`,
      idempotencyKey: `commission_deduction:${request._id.toString()}`,
      requestId: request._id.toString(),
      metadata: {
        serviceAmountGhs: Number(request.quotedPrice),
        percent: env.PROVIDER_COMMISSION_PERCENT,
      },
    });
    if (posted.created) {
      await captureReserved(mechanicId, amount, { totalCommissionPesewas: amount });
      const mechanic = await mechanicRepository.findById(mechanicId);
      if (mechanic) {
        await notificationRepository.create({
          title: 'Commission deducted',
          body: `₵${pesewasToGhs(amount).toFixed(2)} (${env.PROVIDER_COMMISSION_PERCENT}%) was deducted for a completed job.`,
          recipient: mechanic.userId,
          type: 'info',
          meta: { requestId: request._id.toString(), walletEvent: 'commission' },
        });
      }
    }
    request.commissionHoldPesewas = 0;
    request.commissionCapturedPesewas = amount;
    await request.save();
  },

  async releaseCommissionHold(request: IRescueRequest) {
    if (!request.mechanic) return;
    if (request.commissionCapturedPesewas > 0) return;
    const hold = request.commissionHoldPesewas ?? 0;
    if (hold <= 0) return;
    const mechanicId = refId(request.mechanic);
    const posted = await postLedger({
      mechanicId,
      type: 'commission_release',
      amountPesewas: hold,
      description: `Commission hold released for cancelled job ${request._id.toString()}`,
      idempotencyKey: `commission_cancel_release:${request._id.toString()}`,
      requestId: request._id.toString(),
    });
    if (posted.created) {
      await releaseReserved(mechanicId, hold);
    }
    request.commissionHoldPesewas = 0;
    await request.save();
  },

  async listPayoutMethods(userId: string) {
    const mechanic = await mechanicForUser(userId);
    const methods = await payoutMethodRepository.findByMechanic(mechanic._id.toString());
    return methods.map(maskPayout);
  },

  async addPayoutMethod(
    userId: string,
    input: {
      kind: 'bank' | 'mobile_money';
      label: string;
      accountName: string;
      accountNumber: string;
      bankCode?: string;
      bankName?: string;
      network?: 'mtn' | 'vodafone' | 'airteltigo';
      isDefault?: boolean;
    },
  ) {
    const mechanic = await mechanicForUser(userId);
    if (input.kind === 'bank' && !input.bankName) {
      throw new ValidationError('Bank name is required');
    }
    if (input.kind === 'mobile_money' && !input.network) {
      throw new ValidationError('Mobile money network is required');
    }
    if (input.isDefault) {
      await payoutMethodRepository.clearDefault(mechanic._id.toString());
    }
    const created = await payoutMethodRepository.create({
      mechanic: mechanic._id,
      kind: input.kind,
      label: input.label,
      accountName: input.accountName,
      accountNumber: input.accountNumber.replace(/\s+/g, ''),
      bankCode: input.bankCode,
      bankName: input.bankName,
      network: input.network,
      verified: true,
      verifiedAt: new Date(),
      isDefault: Boolean(input.isDefault),
    });
    await walletAuditRepository.create({
      mechanic: mechanic._id,
      actorUser: userId,
      action: 'payout_method_created',
      metadata: { payoutMethodId: created._id.toString(), kind: created.kind },
    });
    return maskPayout(created);
  },

  async verifyPayoutMethod(adminUserId: string, methodId: string) {
    const method = await payoutMethodRepository.findById(methodId);
    if (!method || !method.active) throw new NotFoundError('Payout destination not found');
    method.verified = true;
    method.verifiedAt = new Date();
    method.verifiedBy = adminUserId as never;
    await method.save();
    await walletAuditRepository.create({
      mechanic: method.mechanic,
      actorUser: adminUserId,
      action: 'payout_method_verified',
      metadata: { payoutMethodId: method._id.toString() },
    });
    return maskPayout(method);
  },

  async listUnverifiedPayoutMethods() {
    const methods = await payoutMethodRepository.listUnverified();
    return methods.map((method) => {
      const mechanic = method.mechanic as unknown as { garageName?: string; _id?: { toString(): string } } | string;
      return {
        ...maskPayout(method),
        mechanicId: typeof mechanic === 'object' && mechanic?._id ? mechanic._id.toString() : String(method.mechanic),
        garageName: typeof mechanic === 'object' ? mechanic.garageName : undefined,
      };
    });
  },

  async updatePayoutMethod(
    userId: string,
    methodId: string,
    input: { isDefault?: boolean; active?: boolean; label?: string },
  ) {
    const mechanic = await mechanicForUser(userId);
    const method = await payoutMethodRepository.findById(methodId);
    if (!method || refId(method.mechanic) !== mechanic._id.toString()) {
      throw new NotFoundError('Payout destination not found');
    }
    if (input.isDefault) {
      await payoutMethodRepository.clearDefault(mechanic._id.toString());
      method.isDefault = true;
    }
    if (typeof input.active === 'boolean') method.active = input.active;
    if (input.label) method.label = input.label;
    await method.save();
    return maskPayout(method);
  },

  async requestWithdrawal(
    userId: string,
    amountGhs: number,
    payoutMethodId: string,
    sourceType: WalletWithdrawalSource = 'deposit_refund',
  ) {
    if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
      throw new ValidationError('Enter a valid withdrawal amount');
    }
    if (amountGhs < env.PROVIDER_WALLET_MIN_WITHDRAWAL_GHS) {
      throw new ValidationError(`Minimum withdrawal is ₵${env.PROVIDER_WALLET_MIN_WITHDRAWAL_GHS}`);
    }
    if (amountGhs > env.PROVIDER_WALLET_MAX_WITHDRAWAL_GHS) {
      throw new ValidationError(`Maximum withdrawal is ₵${env.PROVIDER_WALLET_MAX_WITHDRAWAL_GHS}`);
    }
    const mechanic = await mechanicForUser(userId);
    const user = await userRepository.findById(userId);
    if (user?.status && user.status !== 'active') {
      throw new ValidationError('This provider account is not eligible to withdraw');
    }
    if (mechanic.verificationStatus && mechanic.verificationStatus !== 'verified') {
      throw new ValidationError('Your provider account must be verified before withdrawing');
    }
    const method = await payoutMethodRepository.findById(payoutMethodId);
    if (!method || refId(method.mechanic) !== mechanic._id.toString() || !method.active) {
      throw new ValidationError('Choose a valid payout destination');
    }

    const amountPesewas = ghsToPesewas(amountGhs);
    const reference = newReference('RR_WDR_');
    await assertWithdrawable(mechanic._id.toString(), amountPesewas, sourceType);

    const withdrawal = await withdrawalRepository.create({
      reference,
      mechanic: mechanic._id,
      payoutMethod: method._id,
      amountPesewas,
      sourceType,
      status: 'pending',
      corporateAllocated: false,
      destinationSnapshot: {
        kind: method.kind,
        label: method.label,
        accountName: method.accountName,
        accountLast4: last4(method.accountNumber),
        bankName: method.bankName,
        network: method.network,
      },
      reserved: false,
      released: false,
      captured: false,
      notifiedEvents: [],
    });
    await walletAuditRepository.create({
      mechanic: mechanic._id,
      actorUser: userId,
      action: 'withdrawal_requested',
      reference,
      amountPesewas,
    });

    await notificationRepository.create({
      title: 'Withdrawal submitted',
      body: `Your ₵${pesewasToGhs(amountPesewas).toFixed(2)} withdrawal request is pending review. Your available balance is unchanged until an administrator approves it.`,
      recipient: mechanic.userId,
      type: 'info',
      meta: { withdrawalId: withdrawal._id.toString(), walletEvent: 'withdrawal_submitted' },
    });
    const admins = await userRepository.findByRole('admin');
    await Promise.all(
      admins.map((admin) =>
        notificationRepository.create({
          title: 'New withdrawal request',
          body: `${mechanic.garageName} requested ₵${pesewasToGhs(amountPesewas).toFixed(2)}.`,
          recipient: admin._id,
          type: 'info',
          meta: { withdrawalId: withdrawal._id.toString() },
        }),
      ),
    );

    return this.serializeWithdrawal(withdrawal);
  },

  serializeWithdrawal(item: IWalletWithdrawal) {
    return {
      id: item._id.toString(),
      reference: item.reference,
      amountGhs: pesewasToGhs(item.amountPesewas),
      sourceType: item.sourceType ?? 'deposit_refund',
      status: item.status,
      destination: item.destinationSnapshot,
      rejectionReason: item.rejectionReason,
      failureReason: item.failureReason,
      cancelReason: item.cancelReason,
      payoutReference: item.payoutReference,
      payoutMethodUsed: item.payoutMethodUsed,
      amountPaidGhs: item.amountPaidPesewas != null ? pesewasToGhs(item.amountPaidPesewas) : undefined,
      payoutDate: item.payoutDate,
      proofUrl: item.proofUrl,
      destinationNote: item.destinationNote,
      createdAt: item.createdAt,
      reviewedAt: item.reviewedAt,
      processedAt: item.processedAt,
      confirmedAt: item.confirmedAt,
      cancelledAt: item.cancelledAt,
    };
  },

  async listWithdrawals(userId: string, query: PaginationQuery) {
    const mechanic = await mechanicForUser(userId);
    const paging = parsePagination(query);
    const [items, total] = await Promise.all([
      withdrawalRepository.findByMechanic(mechanic._id.toString(), paging.skip, paging.limit),
      withdrawalRepository.countByMechanic(mechanic._id.toString()),
    ]);
    return {
      items: items.map((item) => this.serializeWithdrawal(item)),
      ...paginationMeta(total, paging.page, paging.limit),
    };
  },

  async adminListWithdrawals(query: PaginationQuery & { status?: string }) {
    const paging = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status === 'in_progress') filter.status = { $in: ['approved', 'processing'] };
    else if (typeof query.status === 'string' && query.status) filter.status = query.status;
    if (paging.q) filter.reference = { $regex: escapeRegex(paging.q), $options: 'i' };
    const [items, total] = await Promise.all([
      withdrawalRepository.list(filter, paging.skip, paging.limit),
      withdrawalRepository.count(filter),
    ]);
    const mechanicIdOf = (item: IWalletWithdrawal) => {
      const mechanic = item.mechanic as unknown as { _id?: { toString(): string } } | string;
      return typeof mechanic === 'object' && mechanic?._id ? mechanic._id.toString() : String(item.mechanic);
    };
    const mechanicIds = [...new Set(items.map(mechanicIdOf))];
    const wallets = new Map(
      await Promise.all(
        mechanicIds.map(async (mechanicId) => {
          const wallet = await walletRepository.findByMechanic(mechanicId);
          return [mechanicId, wallet] as const;
        }),
      ),
    );
    return {
      items: items.map((item) => {
        const mechanic = item.mechanic as unknown as { garageName?: string } | string;
        const mechanicId = mechanicIdOf(item);
        const wallet = wallets.get(mechanicId);
        return {
          ...this.serializeWithdrawal(item),
          mechanicId,
          garageName: typeof mechanic === 'object' ? mechanic.garageName : undefined,
          availableGhs: wallet ? pesewasToGhs(wallet.availablePesewas) : undefined,
        };
      }),
      ...paginationMeta(total, paging.page, paging.limit),
    };
  },

  async adminGetWithdrawal(id: string) {
    const item = await withdrawalRepository.findById(id);
    if (!item) throw new NotFoundError('Withdrawal not found');
    const mechanic = item.mechanic as unknown as { garageName?: string; _id?: { toString(): string } } | string;
    const method = item.payoutMethod as unknown as IPayoutMethod | string;
    const mechanicId = typeof mechanic === 'object' && mechanic?._id ? mechanic._id.toString() : String(item.mechanic);
    const wallet = await walletRepository.ensure(mechanicId);
    const serialized = this.serializeWithdrawal(item);
    return {
      ...serialized,
      mechanicId,
      garageName: typeof mechanic === 'object' ? mechanic.garageName : undefined,
      reviewedBy: item.reviewedBy ? String(item.reviewedBy) : undefined,
      processedBy: item.processedBy ? String(item.processedBy) : undefined,
      confirmedBy: item.confirmedBy ? String(item.confirmedBy) : undefined,
      wallet: {
        ...serializeWallet(wallet),
        ...(await withdrawalBuckets(mechanicId)),
      },
      destination: {
        ...serialized.destination,
        accountNumber: typeof method === 'object' ? method.accountNumber : undefined,
      },
    };
  },

  async approveWithdrawal(adminUserId: string, id: string) {
    const item = await withdrawalRepository.findById(id);
    if (!item) throw new NotFoundError('Withdrawal not found');
    if (item.status !== 'pending') throw new ValidationError('Only pending withdrawals can be approved');
    if (item.released || item.captured) {
      throw new ValidationError('This withdrawal can no longer be approved');
    }
    const reviewedAt = new Date();
    const claimed = await withdrawalRepository.transitionStatus(id, ['pending'], {
      status: 'approved',
      reviewedBy: adminUserId as never,
      reviewedAt,
    });
    if (!claimed) throw new ConflictError('This withdrawal was already reviewed by another administrator');
    try {
      if (!item.reserved) {
        await reserveForWithdrawal(
          refId(item.mechanic),
          item.amountPesewas,
          item.sourceType ?? 'deposit_refund',
        );
        try {
          await postLedger({
            mechanicId: refId(item.mechanic),
            type: 'withdrawal_reservation',
            sourceType: item.sourceType === 'service_earnings' ? 'service_earnings' : 'provider_deposit',
            amountPesewas: item.amountPesewas,
            description: `Withdrawal approved ${item.reference}`,
            idempotencyKey: `withdrawal_reservation:${item.reference}`,
            withdrawalId: item._id.toString(),
            actorType: 'admin',
            actorUserId: adminUserId,
          });
          item.reserved = true;
        } catch (error) {
          if (item.sourceType === 'service_earnings') {
            await releaseEarnings(refId(item.mechanic), item.amountPesewas).catch(() => undefined);
          } else {
            await releaseReserved(refId(item.mechanic), item.amountPesewas).catch(() => undefined);
          }
          throw error;
        }
      }
    } catch (error) {
      await withdrawalRepository.transitionStatus(id, ['approved'], {
        status: 'pending',
        reviewedBy: undefined,
        reviewedAt: undefined,
      });
      throw error;
    }
    item.status = 'approved';
    item.corporateAllocated = false;
    item.reviewedBy = adminUserId as never;
    item.reviewedAt = reviewedAt;
    await item.save();
    await walletAuditRepository.create({
      mechanic: item.mechanic,
      actorUser: adminUserId,
      action: 'withdrawal_approved',
      reference: item.reference,
      amountPesewas: item.amountPesewas,
    });
    const mechanic = await mechanicRepository.findById(refId(item.mechanic));
    if (mechanic && !item.notifiedEvents.includes('approved')) {
      await notificationRepository.create({
        title: 'Withdrawal approved',
        body: `Your ₵${pesewasToGhs(item.amountPesewas).toFixed(2)} withdrawal was approved and will be paid out.`,
        recipient: mechanic.userId,
        type: 'success',
        meta: { withdrawalId: item._id.toString() },
      });
      item.notifiedEvents.push('approved');
      await item.save();
    }
    return this.serializeWithdrawal(item);
  },

  async rejectWithdrawal(adminUserId: string, id: string, reason: string) {
    const item = await withdrawalRepository.findById(id);
    if (!item) throw new NotFoundError('Withdrawal not found');
    if (item.status === 'rejected') {
      return this.serializeWithdrawal(item);
    }
    if (item.status !== 'pending') {
      throw new ValidationError('Only pending withdrawals can be rejected. Cancel or fail approved payouts instead.');
    }
    const claimed = await withdrawalRepository.transitionStatus(id, ['pending'], {
      status: 'rejected',
      rejectionReason: reason,
    });
    if (!claimed) throw new ConflictError('This withdrawal was already reviewed by another administrator');
    await this.releaseWithdrawal(item, `withdrawal_release:${item.reference}`);
    item.status = 'rejected';
    item.rejectionReason = reason;
    item.reviewedBy = adminUserId as never;
    item.reviewedAt = new Date();
    await item.save();
    await walletAuditRepository.create({
      mechanic: item.mechanic,
      actorUser: adminUserId,
      action: 'withdrawal_rejected',
      reason,
      reference: item.reference,
      amountPesewas: item.amountPesewas,
    });
    const mechanic = await mechanicRepository.findById(refId(item.mechanic));
    if (mechanic && !item.notifiedEvents.includes('rejected')) {
      await notificationRepository.create({
        title: 'Withdrawal rejected',
        body: reason || 'Your withdrawal request was rejected.',
        recipient: mechanic.userId,
        type: 'warning',
        meta: { withdrawalId: item._id.toString() },
      });
      item.notifiedEvents.push('rejected');
      await item.save();
    }
    return this.serializeWithdrawal(item);
  },

  async processWithdrawal(adminUserId: string, id: string, payoutMethodUsed: string) {
    const item = await withdrawalRepository.findById(id);
    if (!item) throw new NotFoundError('Withdrawal not found');
    if (item.status !== 'approved' && item.status !== 'processing') {
      throw new ValidationError('Approve the withdrawal before processing payout');
    }
    const claimed = await withdrawalRepository.transitionStatus(id, ['approved', 'processing'], {
      status: 'processing',
    });
    if (!claimed) throw new ConflictError('This withdrawal changed status. Refresh and try again.');
    item.status = 'processing';
    item.payoutMethodUsed = payoutMethodUsed;
    item.processedBy = adminUserId as never;
    item.processedAt = new Date();
    await item.save();
    await walletAuditRepository.create({
      mechanic: item.mechanic,
      actorUser: adminUserId,
      action: 'withdrawal_processing',
      reference: item.reference,
      metadata: { payoutMethodUsed },
    });
    const mechanic = await mechanicRepository.findById(refId(item.mechanic));
    if (mechanic && !item.notifiedEvents.includes('processing')) {
      await notificationRepository.create({
        title: 'Withdrawal processing',
        body: `Road Rescue has started the ₵${pesewasToGhs(item.amountPesewas).toFixed(2)} transfer to your ${item.destinationSnapshot.label}.`,
        recipient: mechanic.userId,
        type: 'info',
        meta: { withdrawalId: item._id.toString() },
      });
      item.notifiedEvents.push('processing');
      await item.save();
    }
    return this.serializeWithdrawal(item);
  },

  async confirmWithdrawal(
    adminUserId: string,
    id: string,
    input: {
      payoutReference: string;
      amountPaidGhs?: number;
      payoutDate?: string;
      proofUrl?: string;
      destinationNote?: string;
    },
  ) {
    const item = await withdrawalRepository.findById(id);
    if (!item) throw new NotFoundError('Withdrawal not found');
    if (item.status === 'completed' && item.captured) {
      return this.serializeWithdrawal(item);
    }
    if (item.status !== 'processing') {
      throw new ValidationError('Record payout processing before confirming the transfer');
    }
    if (!input.payoutReference.trim()) throw new ValidationError('Payout reference is required');
    const amountPaidPesewas =
      input.amountPaidGhs != null ? ghsToPesewas(input.amountPaidGhs) : item.amountPesewas;
    if (amountPaidPesewas !== item.amountPesewas) {
      throw new ValidationError('The amount paid must match the reserved withdrawal amount');
    }

    const claimed = await withdrawalRepository.transitionStatus(id, ['processing'], {
      status: 'completed',
    });
    if (!claimed) {
      const latest = await withdrawalRepository.findById(id);
      if (latest?.status === 'completed' && latest.captured) return this.serializeWithdrawal(latest);
      throw new ConflictError('This payout is already being confirmed by another administrator');
    }

    try {
      await this.capturePaidWithdrawal(adminUserId, item, input.payoutReference.trim());
    } catch (error) {
      await withdrawalRepository.transitionStatus(id, ['completed'], { status: 'processing' });
      throw error;
    }
    item.status = 'completed';
    item.captured = true;
    item.payoutReference = input.payoutReference.trim();
    item.amountPaidPesewas = amountPaidPesewas;
    item.payoutDate = input.payoutDate ? new Date(input.payoutDate) : new Date();
    item.proofUrl = input.proofUrl?.trim();
    item.destinationNote = input.destinationNote?.trim();
    item.confirmedBy = adminUserId as never;
    item.confirmedAt = new Date();
    await item.save();
    await walletAuditRepository.create({
      mechanic: item.mechanic,
      actorUser: adminUserId,
      action: 'withdrawal_confirmed',
      reference: item.reference,
      amountPesewas: item.amountPesewas,
      metadata: { payoutReference: input.payoutReference.trim() },
    });
    const mechanic = await mechanicRepository.findById(refId(item.mechanic));
    if (mechanic && !item.notifiedEvents.includes('paid')) {
      await notificationRepository.create({
        title: 'Withdrawal paid',
        body: `₵${pesewasToGhs(item.amountPesewas).toFixed(2)} was sent to your ${item.destinationSnapshot.label}.`,
        recipient: mechanic.userId,
        type: 'success',
        meta: { withdrawalId: item._id.toString() },
      });
      item.notifiedEvents.push('paid');
      await item.save();
    }
    return this.serializeWithdrawal(item);
  },

  async capturePaidWithdrawal(adminUserId: string, item: IWalletWithdrawal, payoutReference: string) {
    const posted = await postLedger({
      mechanicId: refId(item.mechanic),
      type: 'withdrawal_completed',
      sourceType: item.sourceType === 'service_earnings' ? 'service_earnings' : 'provider_deposit',
      amountPesewas: item.amountPesewas,
      description: `Withdrawal paid ${item.reference}`,
      idempotencyKey: `withdrawal_completed:${item.reference}`,
      withdrawalId: item._id.toString(),
      actorType: 'admin',
      actorUserId: adminUserId,
      metadata: { payoutReference },
    });
    if (posted.created) {
      await captureReserved(refId(item.mechanic), item.amountPesewas, {
        totalWithdrawnPesewas: item.amountPesewas,
      });
    }
    if (item.corporateAllocated) {
      await corporateCashService.completePayout({
        adminUserId,
        amountPesewas: item.amountPesewas,
        withdrawalId: item._id.toString(),
        description: `Payout completed ${item.reference}`,
      });
    }
  },

  async failWithdrawal(adminUserId: string, id: string, reason: string) {
    const item = await withdrawalRepository.findById(id);
    if (!item) throw new NotFoundError('Withdrawal not found');
    if (item.status === 'failed' && item.released) {
      return this.serializeWithdrawal(item);
    }
    if (item.status === 'completed') throw new ValidationError('A completed payout cannot fail');
    if (!['approved', 'processing'].includes(item.status)) {
      throw new ValidationError('Only approved or processing payouts can be marked failed');
    }
    const claimed = await withdrawalRepository.transitionStatus(id, [item.status], {
      status: 'failed',
      failureReason: reason,
    });
    if (!claimed) throw new ConflictError('This withdrawal changed status. Refresh and try again.');
    if (item.corporateAllocated) {
      await corporateCashService.releasePayout({
        adminUserId,
        amountPesewas: item.amountPesewas,
        withdrawalId: item._id.toString(),
        description: `Payout failed ${item.reference}`,
      });
      item.corporateAllocated = false;
    }
    await this.releaseWithdrawal(item, `withdrawal_fail_release:${item.reference}`);
    item.status = 'failed';
    item.failureReason = reason;
    item.processedBy = adminUserId as never;
    await item.save();
    await walletAuditRepository.create({
      mechanic: item.mechanic,
      actorUser: adminUserId,
      action: 'withdrawal_failed',
      reason,
      reference: item.reference,
      amountPesewas: item.amountPesewas,
    });
    const mechanic = await mechanicRepository.findById(refId(item.mechanic));
    if (mechanic && !item.notifiedEvents.includes('failed')) {
      await notificationRepository.create({
        title: 'Withdrawal payout failed',
        body: reason || 'Payout failed. Reserved funds were returned to your wallet.',
        recipient: mechanic.userId,
        type: 'critical',
        meta: { withdrawalId: item._id.toString() },
      });
      item.notifiedEvents.push('failed');
      await item.save();
    }
    return this.serializeWithdrawal(item);
  },

  async cancelWithdrawal(actorUserId: string, id: string, reason: string, asAdmin: boolean) {
    const item = await withdrawalRepository.findById(id);
    if (!item) throw new NotFoundError('Withdrawal not found');
    if (item.status === 'cancelled') return this.serializeWithdrawal(item);
    const allowed = asAdmin ? ['pending', 'approved'] : ['pending'];
    if (!allowed.includes(item.status)) {
      throw new ValidationError(
        asAdmin
          ? 'Only pending or approved withdrawals can be cancelled'
          : 'Only pending withdrawals can be cancelled',
      );
    }
    const claimed = await withdrawalRepository.transitionStatus(id, [item.status], {
      status: 'cancelled',
      cancelReason: reason,
    });
    if (!claimed) throw new ConflictError('This withdrawal changed status. Refresh and try again.');
    if (item.status === 'approved' && item.corporateAllocated) {
      await corporateCashService.releasePayout({
        adminUserId: actorUserId,
        amountPesewas: item.amountPesewas,
        withdrawalId: item._id.toString(),
        description: `Payout cancelled ${item.reference}`,
      });
      item.corporateAllocated = false;
    }
    await this.releaseWithdrawal(item, `withdrawal_cancel_release:${item.reference}`);
    item.status = 'cancelled';
    item.cancelReason = reason;
    item.cancelledBy = actorUserId as never;
    item.cancelledAt = new Date();
    await item.save();
    await walletAuditRepository.create({
      mechanic: item.mechanic,
      actorUser: actorUserId,
      action: 'withdrawal_cancelled',
      reason,
      reference: item.reference,
      amountPesewas: item.amountPesewas,
    });
    const mechanic = await mechanicRepository.findById(refId(item.mechanic));
    if (mechanic && !item.notifiedEvents.includes('cancelled')) {
      await notificationRepository.create({
        title: 'Withdrawal cancelled',
        body:
          reason ||
          (item.reserved
            ? 'Your withdrawal was cancelled and reserved funds were returned.'
            : 'Your withdrawal request was cancelled.'),
        recipient: mechanic.userId,
        type: 'warning',
        meta: { withdrawalId: item._id.toString() },
      });
      item.notifiedEvents.push('cancelled');
      await item.save();
    }
    return this.serializeWithdrawal(item);
  },

  async cancelOwnWithdrawal(userId: string, id: string, reason: string) {
    const mechanic = await mechanicForUser(userId);
    const item = await withdrawalRepository.findById(id);
    if (!item) throw new NotFoundError('Withdrawal not found');
    if (refId(item.mechanic) !== mechanic._id.toString()) {
      throw new ForbiddenError('You cannot cancel another provider’s withdrawal');
    }
    return this.cancelWithdrawal(userId, id, reason, false);
  },

  async releaseWithdrawal(item: IWalletWithdrawal, idempotencyKey: string) {
    if (item.released || item.captured || !item.reserved) return;
    const posted = await postLedger({
      mechanicId: refId(item.mechanic),
      type: 'withdrawal_release',
      sourceType: item.sourceType === 'service_earnings' ? 'service_earnings' : 'provider_deposit',
      amountPesewas: item.amountPesewas,
      description: `Withdrawal funds returned ${item.reference}`,
      idempotencyKey,
      withdrawalId: item._id.toString(),
    });
    if (posted.created) {
      if (item.sourceType === 'service_earnings') {
        await releaseEarnings(refId(item.mechanic), item.amountPesewas);
      } else {
        await releaseReserved(refId(item.mechanic), item.amountPesewas);
      }
    }
    item.released = true;
    await item.save();
  },

  async creditPendingEarning(input: {
    mechanicId: string;
    amountPesewas: number;
    paymentId: string;
    requestId: string;
    paystackReference?: string;
  }) {
    if (input.amountPesewas <= 0) return;
    await walletRepository.ensure(input.mechanicId);
    const posted = await postLedger({
      mechanicId: input.mechanicId,
      type: 'earning_pending',
      sourceType: 'service_earnings',
      amountPesewas: input.amountPesewas,
      description: `Service earnings pending settlement for job ${input.requestId}`,
      idempotencyKey: `earning_pending:${input.paymentId}`,
      paymentId: input.paymentId,
      requestId: input.requestId,
      paystackReference: input.paystackReference,
    });
    if (posted.created) {
      await walletRepository.incrementIf(input.mechanicId, {}, {
        pendingPesewas: input.amountPesewas,
        totalEarnedPesewas: input.amountPesewas,
      });
    }
  },

  async settleServiceEarning(input: {
    mechanicId: string;
    amountPesewas: number;
    paymentId: string;
    settlementId: string;
    adminUserId: string;
  }) {
    if (input.amountPesewas <= 0) return;
    const posted = await postLedger({
      mechanicId: input.mechanicId,
      type: 'earning_available',
      sourceType: 'service_earnings',
      amountPesewas: input.amountPesewas,
      description: `Service earnings available after settlement`,
      idempotencyKey: `earning_available:${input.paymentId}`,
      paymentId: input.paymentId,
      settlementId: input.settlementId,
      actorType: 'admin',
      actorUserId: input.adminUserId,
    });
    if (!posted.created) return;
    const updated = await walletRepository.incrementIf(
      input.mechanicId,
      { pendingPesewas: { $gte: input.amountPesewas } },
      { pendingPesewas: -input.amountPesewas, earningsAvailablePesewas: input.amountPesewas },
    );
    if (!updated) {
      throw new ConflictError('Pending service earnings are no longer available to settle');
    }
  },

  async reversePrepaidCommissionForJobPayment(request: IRescueRequest) {
    if (!request.mechanic) return;
    const amount = request.commissionCapturedPesewas ?? 0;
    if (amount <= 0) return;
    const mechanicId = refId(request.mechanic);
    const posted = await postLedger({
      mechanicId,
      type: 'commission_reversal',
      sourceType: 'commission',
      amountPesewas: amount,
      description: `Prepaid commission reversed after in-app job payment ${request._id.toString()}`,
      idempotencyKey: `commission_reversal_job_payment:${request._id.toString()}`,
      requestId: request._id.toString(),
    });
    if (posted.created) {
      await walletRepository.incrementIf(
        mechanicId,
        { totalCommissionPesewas: { $gte: amount } },
        { availablePesewas: amount, totalCommissionPesewas: -amount, totalReversedPesewas: amount },
      );
    }
    request.commissionCapturedPesewas = 0;
    request.commissionHoldPesewas = 0;
    await request.save();
  },

  async overview() {
    const wallets = await walletRepository.listAll();
    const pending = await withdrawalRepository.count({ status: 'pending' });
    const failed = await withdrawalRepository.count({ status: 'failed' });
    const recent = await ledgerRepository.findRecent(20);
    const cash = await corporateCashService.snapshot();
    const totals = wallets.reduce(
      (acc, wallet) => {
        acc.depositAvailablePesewas += wallet.availablePesewas;
        acc.earningsAvailablePesewas += wallet.earningsAvailablePesewas ?? 0;
        acc.pendingPesewas += wallet.pendingPesewas ?? 0;
        acc.reservedPesewas += wallet.reservedPesewas;
        acc.depositedPesewas += wallet.totalDepositedPesewas;
        acc.commissionPesewas += wallet.totalCommissionPesewas;
        acc.withdrawnPesewas += wallet.totalWithdrawnPesewas;
        acc.earnedPesewas += wallet.totalEarnedPesewas ?? 0;
        return acc;
      },
      {
        depositAvailablePesewas: 0,
        earningsAvailablePesewas: 0,
        pendingPesewas: 0,
        reservedPesewas: 0,
        depositedPesewas: 0,
        commissionPesewas: 0,
        withdrawnPesewas: 0,
        earnedPesewas: 0,
      },
    );
    return {
      currency: 'GHS',
      totalAvailableGhs: pesewasToGhs(totals.depositAvailablePesewas),
      totalEarningsAvailableGhs: pesewasToGhs(totals.earningsAvailablePesewas),
      totalPendingSettlementGhs: pesewasToGhs(totals.pendingPesewas),
      totalDepositAvailableGhs: pesewasToGhs(totals.depositAvailablePesewas),
      totalReservedGhs: pesewasToGhs(totals.reservedPesewas),
      totalDepositedGhs: pesewasToGhs(totals.depositedPesewas),
      totalCommissionGhs: pesewasToGhs(totals.commissionPesewas),
      totalEarnedGhs: pesewasToGhs(totals.earnedPesewas),
      totalWithdrawnGhs: pesewasToGhs(totals.withdrawnPesewas),
      pendingWithdrawals: pending,
      failedWithdrawals: failed,
      providerAccounts: wallets.length,
      corporateCash: cash,
      recentActivity: recent.map((entry) => ({
        reference: entry.reference,
        mechanicId: String(entry.mechanic),
        type: entry.type,
        description: entry.description,
        amountGhs: pesewasToGhs(entry.amountPesewas),
        status: entry.status,
        createdAt: entry.createdAt,
      })),
    };
  },

  async adminMechanicAccount(mechanicId: string) {
    const mechanic = await mechanicRepository.findById(mechanicId);
    if (!mechanic) throw new NotFoundError('Provider not found');
    const wallet = await walletRepository.ensure(mechanicId);
    const [deposits, withdrawals, ledger, payoutMethods] = await Promise.all([
      depositRepository.findByMechanic(mechanicId, 0, 20),
      withdrawalRepository.findByMechanic(mechanicId, 0, 20),
      ledgerRepository.findByMechanic(mechanicId, { skip: 0, limit: 30 }),
      payoutMethodRepository.findByMechanic(mechanicId),
    ]);
    return {
      mechanicId,
      garageName: mechanic.garageName,
      wallet: {
        ...serializeWallet(wallet),
        ...(await withdrawalBuckets(mechanicId)),
      },
      payoutMethods: (payoutMethods ?? []).map(maskPayout),
      deposits: deposits.map((item) => ({
        reference: item.reference,
        amountGhs: pesewasToGhs(item.amountPesewas),
        status: item.status,
        createdAt: item.createdAt,
      })),
      withdrawals: withdrawals.map((item) => this.serializeWithdrawal(item)),
      ledger: ledger.map((entry) => ({
        reference: entry.reference,
        type: entry.type,
        description: entry.description,
        amountGhs: pesewasToGhs(entry.amountPesewas),
        status: entry.status,
        createdAt: entry.createdAt,
      })),
    };
  },

  async adjust(
    adminUserId: string,
    mechanicId: string,
    input: { amountGhs: number; reason: string; reference?: string },
  ) {
    if (!input.reason?.trim()) throw new ValidationError('Adjustment reason is required');
    const amountPesewas = ghsToPesewas(input.amountGhs);
    if (amountPesewas === 0) throw new ValidationError('Adjustment amount cannot be zero');
    const mechanic = await mechanicRepository.findById(mechanicId);
    if (!mechanic) throw new NotFoundError('Provider not found');
    await walletRepository.ensure(mechanicId);
    const credit = amountPesewas > 0;
    const abs = Math.abs(amountPesewas);
    const key = `adjustment:${input.reference ?? crypto.randomUUID()}`;
    if (!credit) {
      const updated = await walletRepository.incrementIf(
        mechanicId,
        { availablePesewas: { $gte: abs } },
        { availablePesewas: -abs },
      );
      if (!updated) throw new ValidationError('Insufficient available balance for this debit');
    }
    const posted = await postLedger({
      mechanicId,
      type: 'adjustment',
      sourceType: 'adjustment',
      amountPesewas: abs,
      description: input.reason.trim(),
      idempotencyKey: key,
      actorType: 'admin',
      actorUserId: adminUserId,
      metadata: { direction: credit ? 'credit' : 'debit', reference: input.reference },
    });
    if (credit && posted.created) {
      await creditAvailable(mechanicId, abs, {});
    }
    if (!credit && !posted.created) {
      await creditAvailable(mechanicId, abs, {});
    }
    await walletAuditRepository.create({
      mechanic: mechanicId,
      actorUser: adminUserId,
      action: 'adjustment',
      reason: input.reason.trim(),
      amountPesewas,
      reference: input.reference,
    });
    return this.adminMechanicAccount(mechanicId);
  },
};

export function commissionConfig() {
  return {
    percent: env.PROVIDER_COMMISSION_PERCENT,
    minAvailableGhs: env.PROVIDER_WALLET_MIN_AVAILABLE_GHS,
  };
}
