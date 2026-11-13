import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, ValidationError } from '../utils/errors.js';

vi.mock('../config/env.js', () => ({
  env: {
    PRIMARY_CLIENT_ORIGIN: 'http://localhost:5173',
    PROVIDER_COMMISSION_PERCENT: 10,
    PROVIDER_WALLET_MIN_DEPOSIT_GHS: 10,
    PROVIDER_WALLET_MIN_AVAILABLE_GHS: 0,
    PROVIDER_WALLET_MIN_WITHDRAWAL_GHS: 20,
    PROVIDER_WALLET_MAX_WITHDRAWAL_GHS: 20_000,
  },
}));

const initializePayment = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    authorizationUrl: 'https://checkout.paystack.com/wallet',
    accessCode: 'access',
    reference: 'RR_PWAL_abc',
  }),
);
const verifyPayment = vi.hoisted(() => vi.fn());

vi.mock('../payments/payment-provider.impl.js', () => ({
  getPaymentProvider: () => ({
    isConfigured: () => true,
    initializePayment,
    verifyPayment,
  }),
}));

vi.mock('../repositories/mechanic.repository.js', () => ({
  mechanicRepository: { findByUserId: vi.fn(), findById: vi.fn() },
}));

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: { findById: vi.fn(), findByRole: vi.fn() },
}));

vi.mock('../repositories/misc.repository.js', () => ({
  notificationRepository: { create: vi.fn().mockResolvedValue({}) },
  paymentRepository: { findByRequest: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../services/corporate-cash.service.js', () => ({
  corporateCashService: {
    snapshot: vi.fn().mockResolvedValue({
      unallocatedPayoutCashGhs: 10_000,
      unallocatedPayoutCashPesewas: 1_000_000,
    }),
    allocatePayout: vi.fn().mockResolvedValue({}),
    releasePayout: vi.fn().mockResolvedValue({}),
    completePayout: vi.fn().mockResolvedValue({}),
    creditSettlement: vi.fn().mockResolvedValue({}),
    recentActivity: vi.fn().mockResolvedValue([]),
    recordCommitment: vi.fn(),
  },
}));

vi.mock('../repositories/wallet.repository.js', () => ({
  walletRepository: {
    ensure: vi.fn(),
    incrementIf: vi.fn(),
    listAll: vi.fn(),
  },
  ledgerRepository: {
    create: vi.fn(),
    findByMechanic: vi.fn(),
    countByMechanic: vi.fn(),
    findRecent: vi.fn(),
  },
  depositRepository: {
    create: vi.fn(),
    findByReference: vi.fn(),
    findByMechanic: vi.fn(),
    countByMechanic: vi.fn(),
  },
  payoutMethodRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByMechanic: vi.fn(),
    clearDefault: vi.fn(),
  },
  withdrawalRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByMechanic: vi.fn(),
    countByMechanic: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    transitionStatus: vi.fn(),
    sumAmount: vi.fn(),
  },
  walletAuditRepository: { create: vi.fn().mockResolvedValue({}) },
}));

import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { notificationRepository } from '../repositories/misc.repository.js';
import {
  depositRepository,
  ledgerRepository,
  payoutMethodRepository,
  walletRepository,
  withdrawalRepository,
} from '../repositories/wallet.repository.js';
import { walletService } from '../services/wallet.service.js';

const userId = '64a0000000000000000000aa';
const otherUserId = '64a0000000000000000000bb';
const mechanicId = '64a0000000000000000000cc';
const adminId = '64a0000000000000000000dd';
const requestId = '64a0000000000000000000ee';
const payoutMethodId = '64a0000000000000000000ff';

type WalletState = {
  availablePesewas: number;
  earningsAvailablePesewas: number;
  pendingPesewas: number;
  reservedPesewas: number;
  totalDepositedPesewas: number;
  totalCommissionPesewas: number;
  totalEarnedPesewas: number;
  totalWithdrawnPesewas: number;
  totalReversedPesewas: number;
  version: number;
};

function cloneWallet(wallet: WalletState) {
  return { ...wallet, mechanic: mechanicId };
}

describe('provider wallet ledger', () => {
  let wallet: WalletState;
  let ledgerKeys: Set<string>;
  let deposits: Array<{
    _id: { toString(): string };
    reference: string;
    mechanic: string;
    amountPesewas: number;
    status: string;
    paystackReference: string;
    credited: boolean;
    notified: boolean;
    channel?: string;
    paidAt?: Date;
    save: () => Promise<void>;
  }>;

  beforeEach(() => {
    vi.clearAllMocks();
    wallet = {
      availablePesewas: 0,
      earningsAvailablePesewas: 0,
      pendingPesewas: 0,
      reservedPesewas: 0,
      totalDepositedPesewas: 0,
      totalCommissionPesewas: 0,
      totalEarnedPesewas: 0,
      totalWithdrawnPesewas: 0,
      totalReversedPesewas: 0,
      version: 0,
    };
    ledgerKeys = new Set();
    deposits = [];

    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue({
      _id: { toString: () => mechanicId },
      userId,
      garageName: 'Accra Rescue',
    } as never);
    vi.mocked(mechanicRepository.findById).mockResolvedValue({
      _id: { toString: () => mechanicId },
      userId,
      garageName: 'Accra Rescue',
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
      _id: userId,
      email: 'provider@example.com',
    } as never);
    vi.mocked(userRepository.findByRole).mockResolvedValue([{ _id: adminId }] as never);
    vi.mocked(notificationRepository.create).mockResolvedValue({} as never);
    vi.mocked(withdrawalRepository.transitionStatus).mockImplementation(async (id, from, set) => {
      const current = (await withdrawalRepository.findById(id)) as unknown as
        | (Record<string, unknown> & { status: string })
        | null;
      if (!current || !from.includes(current.status as never)) return null as never;
      Object.assign(current, set);
      return current as never;
    });

    vi.mocked(walletRepository.ensure).mockImplementation(async () => cloneWallet(wallet) as never);
    vi.mocked(walletRepository.incrementIf).mockImplementation(async (_id, filter, inc) => {
      const availableGte = (filter.availablePesewas as { $gte?: number } | undefined)?.$gte;
      const reservedGte = (filter.reservedPesewas as { $gte?: number } | undefined)?.$gte;
      const earningsGte = (filter.earningsAvailablePesewas as { $gte?: number } | undefined)?.$gte;
      const pendingGte = (filter.pendingPesewas as { $gte?: number } | undefined)?.$gte;
      if (availableGte !== undefined && wallet.availablePesewas < availableGte) return null;
      if (reservedGte !== undefined && wallet.reservedPesewas < reservedGte) return null;
      if (earningsGte !== undefined && wallet.earningsAvailablePesewas < earningsGte) return null;
      if (pendingGte !== undefined && wallet.pendingPesewas < pendingGte) return null;
      for (const [key, delta] of Object.entries(inc)) {
        (wallet as unknown as Record<string, number>)[key] =
          ((wallet as unknown as Record<string, number>)[key] ?? 0) + delta;
      }
      if (wallet.availablePesewas < 0 || wallet.reservedPesewas < 0) return null;
      wallet.version += 1;
      return cloneWallet(wallet) as never;
    });

    vi.mocked(ledgerRepository.create).mockImplementation(async (data) => {
      const key = String(data.idempotencyKey);
      if (ledgerKeys.has(key)) {
        const error = Object.assign(new Error('duplicate'), { code: 11000 });
        throw error;
      }
      ledgerKeys.add(key);
      return { ...data, _id: key };
    });

    vi.mocked(depositRepository.create).mockImplementation(async (data) => {
      const doc = {
        _id: { toString: () => 'dep1' },
        reference: String(data.reference),
        mechanic: mechanicId,
        amountPesewas: Number(data.amountPesewas),
        status: String(data.status),
        paystackReference: String(data.paystackReference ?? data.reference),
        credited: false,
        notified: false,
        save: async function save() {
          return;
        },
      };
      deposits.push(doc);
      return doc as never;
    });
    vi.mocked(depositRepository.findByReference).mockImplementation(async (reference) => {
      return (deposits.find(
        (item) => item.reference === reference || item.paystackReference === reference,
      ) ?? null) as never;
    });
    vi.mocked(depositRepository.findByMechanic).mockResolvedValue([] as never);
    vi.mocked(depositRepository.countByMechanic).mockResolvedValue(0);
    vi.mocked(withdrawalRepository.findByMechanic).mockResolvedValue([] as never);
    vi.mocked(withdrawalRepository.sumAmount).mockResolvedValue([] as never);
    vi.mocked(withdrawalRepository.countByMechanic).mockResolvedValue(0);
    vi.mocked(ledgerRepository.findByMechanic).mockResolvedValue([] as never);
    vi.mocked(ledgerRepository.countByMechanic).mockResolvedValue(0);
  });

  async function creditDeposit(amountGhs = 200) {
    initializePayment.mockResolvedValueOnce({
      authorizationUrl: 'https://checkout.paystack.com/wallet',
      accessCode: 'access',
      reference: 'RR_PWAL_abc',
    });
    const initiated = await walletService.initiateDeposit(userId, amountGhs);
    verifyPayment.mockResolvedValue({
      status: 'success',
      amountPesewas: amountGhs * 100,
      currency: 'GHS',
      channel: 'card',
      paid_at: new Date().toISOString(),
    });
    await walletService.verifyDeposit(userId, initiated.reference);
    return initiated;
  }

  it('credits a successful Paystack deposit once', async () => {
    await creditDeposit(200);
    expect(wallet.availablePesewas).toBe(20_000);
    expect(wallet.totalDepositedPesewas).toBe(20_000);
    await walletService.fulfillVerifiedDeposit('RR_PWAL_abc');
    expect(wallet.availablePesewas).toBe(20_000);
    expect(ledgerKeys.has('deposit_credit:RR_PWAL_abc')).toBe(true);

    const view = await walletService.getWalletForUser(userId);
    expect(view.availableGhs).toBe(200);
    expect(view.totalCommissionGhs).toBe(0);
  });

  it('rejects amount and currency mismatches', async () => {
    await walletService.initiateDeposit(userId, 200);
    verifyPayment.mockResolvedValue({
      status: 'success',
      amountPesewas: 15_000,
      currency: 'GHS',
    });
    await expect(walletService.verifyDeposit(userId, 'RR_PWAL_abc')).rejects.toBeInstanceOf(
      ValidationError,
    );

    deposits[0].status = 'pending';
    deposits[0].credited = false;
    verifyPayment.mockResolvedValue({
      status: 'success',
      amountPesewas: 20_000,
      currency: 'USD',
    });
    await expect(walletService.verifyDeposit(userId, 'RR_PWAL_abc')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(wallet.availablePesewas).toBe(0);
  });

  it('does not credit failed payments', async () => {
    await walletService.initiateDeposit(userId, 200);
    verifyPayment.mockResolvedValue({
      status: 'failed',
      amountPesewas: 20_000,
      currency: 'GHS',
    });
    const result = await walletService.verifyDeposit(userId, 'RR_PWAL_abc');
    expect(result?.deposit.status).toBe('failed');
    expect(wallet.availablePesewas).toBe(0);
  });

  it('blocks another provider from verifying a deposit', async () => {
    await walletService.initiateDeposit(userId, 200);
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue({
      _id: { toString: () => '64a000000000000000000099' },
      userId: otherUserId,
    } as never);
    await expect(walletService.verifyDeposit(otherUserId, 'RR_PWAL_abc')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('reserves and deducts 10% commission exactly once on the chargeable job', async () => {
    await creditDeposit(200);
    const request = {
      _id: { toString: () => requestId },
      mechanic: mechanicId,
      quotedPrice: 150,
      commissionHoldPesewas: 0,
      commissionCapturedPesewas: 0,
      save: vi.fn().mockResolvedValue(undefined),
    };

    await walletService.syncCommissionHoldForRequest(request as never);
    expect(wallet.availablePesewas).toBe(18_500);
    expect(wallet.reservedPesewas).toBe(1_500);

    await walletService.captureCommission(request as never);
    await walletService.captureCommission(request as never);
    expect(wallet.availablePesewas).toBe(18_500);
    expect(wallet.reservedPesewas).toBe(0);
    expect(wallet.totalCommissionPesewas).toBe(1_500);
    expect(request.commissionCapturedPesewas).toBe(1_500);

    const view = await walletService.getWalletForUser(userId);
    expect(view.availableGhs).toBe(185);
    expect(view.totalCommissionGhs).toBe(15);
  });

  it.each([
    [5, 1_000, 19_000],
    [10, 2_000, 18_000],
  ])('deducts the configured %i%% commission on a ₵200 job', async (percent, commission, left) => {
    const { env } = await import('../config/env.js');
    const original = env.PROVIDER_COMMISSION_PERCENT;
    env.PROVIDER_COMMISSION_PERCENT = percent;
    try {
      await creditDeposit(200);
      const request = {
        _id: { toString: () => requestId },
        mechanic: mechanicId,
        quotedPrice: 200,
        commissionHoldPesewas: 0,
        commissionCapturedPesewas: 0,
        save: vi.fn().mockResolvedValue(undefined),
      };
      await walletService.syncCommissionHoldForRequest(request as never);
      await walletService.captureCommission(request as never);
      expect(request.commissionCapturedPesewas).toBe(commission);
      expect(wallet.availablePesewas).toBe(left);
      const entry = vi
        .mocked(ledgerRepository.create)
        .mock.calls.map((call) => call[0])
        .find((data) => data.type === 'commission_deduction');
      expect(entry?.metadata).toMatchObject({ serviceAmountGhs: 200, percent });
    } finally {
      env.PROVIDER_COMMISSION_PERCENT = original;
    }
  });

  it('releases a commission hold when the job is cancelled', async () => {
    await creditDeposit(200);
    const request = {
      _id: { toString: () => requestId },
      mechanic: mechanicId,
      quotedPrice: 150,
      commissionHoldPesewas: 0,
      commissionCapturedPesewas: 0,
      save: vi.fn().mockResolvedValue(undefined),
    };
    await walletService.syncCommissionHoldForRequest(request as never);
    await walletService.releaseCommissionHold(request as never);
    await walletService.releaseCommissionHold(request as never);
    expect(wallet.availablePesewas).toBe(20_000);
    expect(wallet.reservedPesewas).toBe(0);
  });

  it('blocks job acceptance when available funds are below the configured minimum', async () => {
    const { env } = await import('../config/env.js');
    env.PROVIDER_WALLET_MIN_AVAILABLE_GHS = 50;
    await expect(walletService.assertCanAcceptJob(userId)).rejects.toBeInstanceOf(ValidationError);
    env.PROVIDER_WALLET_MIN_AVAILABLE_GHS = 0;
  });

  it('cannot reserve commission without available funds', async () => {
    const request = {
      _id: { toString: () => requestId },
      mechanic: mechanicId,
      quotedPrice: 150,
      commissionHoldPesewas: 0,
      commissionCapturedPesewas: 0,
      save: vi.fn().mockResolvedValue(undefined),
    };
    await expect(walletService.syncCommissionHoldForRequest(request as never)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('does not deduct available balance until an administrator approves', async () => {
    await creditDeposit(200);
    const request = {
      _id: { toString: () => requestId },
      mechanic: mechanicId,
      quotedPrice: 150,
      commissionHoldPesewas: 0,
      commissionCapturedPesewas: 0,
      save: vi.fn().mockResolvedValue(undefined),
    };
    await walletService.syncCommissionHoldForRequest(request as never);
    await walletService.captureCommission(request as never);

    const method = {
      _id: payoutMethodId,
      mechanic: mechanicId,
      kind: 'mobile_money',
      label: 'MTN MoMo',
      accountName: 'Kwame',
      accountNumber: '0241234567',
      network: 'mtn',
      verified: true,
      active: true,
    };
    vi.mocked(payoutMethodRepository.findById).mockResolvedValue(method as never);

    let stored: Record<string, unknown> | null = null;
    vi.mocked(withdrawalRepository.create).mockImplementation(async (data) => {
      stored = {
        ...data,
        _id: { toString: () => 'wdr1' },
        save: async function save(this: Record<string, unknown>) {
          stored = { ...stored, ...this };
        },
        notifiedEvents: [],
      };
      return stored as never;
    });
    vi.mocked(withdrawalRepository.findById).mockImplementation(async () => stored as never);

    await walletService.requestWithdrawal(userId, 100, payoutMethodId);
    expect(wallet.availablePesewas).toBe(18_500);
    expect(wallet.reservedPesewas).toBe(0);
    expect(stored?.reserved).toBe(false);
    expect(stored?.status).toBe('pending');

    await walletService.rejectWithdrawal(adminId, 'wdr1', 'Account name mismatch');
    await walletService.rejectWithdrawal(adminId, 'wdr1', 'Account name mismatch');
    expect(wallet.availablePesewas).toBe(18_500);
    expect(wallet.reservedPesewas).toBe(0);
    expect(wallet.totalWithdrawnPesewas).toBe(0);
  });

  it('reserves available funds on approval and returns them if the payout fails', async () => {
    await creditDeposit(200);
    vi.mocked(payoutMethodRepository.findById).mockResolvedValue({
      _id: payoutMethodId,
      mechanic: mechanicId,
      kind: 'bank',
      label: 'GCB',
      accountName: 'Kwame',
      accountNumber: '1234567890',
      verified: true,
      active: true,
    } as never);
    let stored: Record<string, unknown> | null = null;
    vi.mocked(withdrawalRepository.create).mockImplementation(async (data) => {
      stored = {
        ...data,
        _id: { toString: () => 'wdr-fail' },
        save: async function save(this: Record<string, unknown>) {
          Object.assign(stored as object, this);
        },
        notifiedEvents: [],
      };
      return stored as never;
    });
    vi.mocked(withdrawalRepository.findById).mockImplementation(async () => stored as never);

    await walletService.requestWithdrawal(userId, 100, payoutMethodId);
    await walletService.approveWithdrawal(adminId, 'wdr-fail');
    expect(wallet.availablePesewas).toBe(10_000);
    expect(wallet.reservedPesewas).toBe(10_000);

    await walletService.failWithdrawal(adminId, 'wdr-fail', 'Bank rejected the transfer');
    expect(wallet.availablePesewas).toBe(20_000);
    expect(wallet.reservedPesewas).toBe(0);
    expect(wallet.totalWithdrawnPesewas).toBe(0);
  });

  it('completes a manual payout once after processing confirmation', async () => {
    await creditDeposit(200);
    const method = {
      _id: payoutMethodId,
      mechanic: mechanicId,
      kind: 'bank',
      label: 'GCB',
      accountName: 'Kwame',
      accountNumber: '1234567890',
      bankName: 'GCB',
      verified: true,
      active: true,
    };
    vi.mocked(payoutMethodRepository.findById).mockResolvedValue(method as never);
    let stored: Record<string, unknown> | null = null;
    vi.mocked(withdrawalRepository.create).mockImplementation(async (data) => {
      stored = {
        ...data,
        _id: { toString: () => 'wdr1' },
        save: async function save(this: Record<string, unknown>) {
          Object.assign(stored as object, this);
        },
        notifiedEvents: [],
      };
      return stored as never;
    });
    vi.mocked(withdrawalRepository.findById).mockImplementation(async () => stored as never);

    await walletService.requestWithdrawal(userId, 100, payoutMethodId);
    expect(wallet.availablePesewas).toBe(20_000);
    expect(wallet.reservedPesewas).toBe(0);
    await walletService.approveWithdrawal(adminId, 'wdr1');
    expect(wallet.availablePesewas).toBe(10_000);
    expect(wallet.reservedPesewas).toBe(10_000);
    await expect(
      walletService.confirmWithdrawal(adminId, 'wdr1', { payoutReference: 'BANK-REF-1' }),
    ).rejects.toBeInstanceOf(ValidationError);

    await walletService.processWithdrawal(adminId, 'wdr1', 'bank_transfer');
    await walletService.confirmWithdrawal(adminId, 'wdr1', { payoutReference: 'BANK-REF-1' });
    await walletService.confirmWithdrawal(adminId, 'wdr1', { payoutReference: 'BANK-REF-1' });
    expect(wallet.availablePesewas).toBe(10_000);
    expect(wallet.reservedPesewas).toBe(0);
    expect(wallet.totalWithdrawnPesewas).toBe(10_000);
  });

  it('lets only one administrator act on a pending withdrawal', async () => {
    await creditDeposit(200);
    vi.mocked(payoutMethodRepository.findById).mockResolvedValue({
      _id: payoutMethodId,
      mechanic: mechanicId,
      kind: 'bank',
      label: 'GCB',
      accountName: 'Kwame',
      accountNumber: '1234567890',
      verified: true,
      active: true,
    } as never);
    let stored: Record<string, unknown> | null = null;
    vi.mocked(withdrawalRepository.create).mockImplementation(async (data) => {
      stored = {
        ...data,
        _id: { toString: () => 'wdr-race' },
        save: async function save(this: Record<string, unknown>) {
          Object.assign(stored as object, this);
        },
        notifiedEvents: [],
      };
      return stored as never;
    });
    vi.mocked(withdrawalRepository.findById).mockImplementation(async () => stored as never);
    await walletService.requestWithdrawal(userId, 100, payoutMethodId);
    // Both administrators loaded the withdrawal while it was still pending.
    const staleView = () => ({
      ...(stored as object),
      status: 'pending',
      save: async () => undefined,
      notifiedEvents: [],
    });
    const firstAdminView = staleView();
    const secondAdminView = staleView();
    vi.mocked(withdrawalRepository.findById)
      .mockImplementationOnce(async () => firstAdminView as never)
      .mockImplementationOnce(async () => stored as never)
      .mockImplementationOnce(async () => secondAdminView as never)
      .mockImplementationOnce(async () => stored as never);

    await walletService.approveWithdrawal(adminId, 'wdr-race');
    await expect(
      walletService.rejectWithdrawal(adminId, 'wdr-race', 'Too late'),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((stored as unknown as { status: string }).status).toBe('approved');
    expect(wallet.reservedPesewas).toBe(10_000);
    expect(wallet.availablePesewas).toBe(10_000);
  });

  it('approves a payout without requiring an internal company wallet balance', async () => {
    const { corporateCashService } = await import('../services/corporate-cash.service.js');
    vi.mocked(corporateCashService.allocatePayout).mockRejectedValue(
      new ValidationError('Confirmed corporate cash is insufficient for this payout.'),
    );
    await creditDeposit(200);
    vi.mocked(payoutMethodRepository.findById).mockResolvedValue({
      _id: payoutMethodId,
      mechanic: mechanicId,
      kind: 'bank',
      label: 'GCB',
      accountName: 'Kwame',
      accountNumber: '1234567890',
      verified: true,
      active: true,
    } as never);
    let stored: Record<string, unknown> | null = null;
    vi.mocked(withdrawalRepository.create).mockImplementation(async (data) => {
      stored = {
        ...data,
        _id: { toString: () => 'wdr-cash' },
        save: async function save(this: Record<string, unknown>) {
          Object.assign(stored as object, this);
        },
        notifiedEvents: [],
      };
      return stored as never;
    });
    vi.mocked(withdrawalRepository.findById).mockImplementation(async () => stored as never);
    await walletService.requestWithdrawal(userId, 100, payoutMethodId);
    await walletService.approveWithdrawal(adminId, 'wdr-cash');
    expect((stored as unknown as { status: string }).status).toBe('approved');
    expect(wallet.availablePesewas).toBe(10_000);
    expect(wallet.reservedPesewas).toBe(10_000);
    expect(corporateCashService.allocatePayout).not.toHaveBeenCalled();
  });

  it('records the direction of manual adjustments in the ledger', async () => {
    await creditDeposit(200);
    await walletService.adjust(adminId, mechanicId, { amountGhs: -10, reason: 'Duplicate refund', reference: 'ADJ-D' });
    await walletService.adjust(adminId, mechanicId, { amountGhs: 5, reason: 'Goodwill credit', reference: 'ADJ-C' });
    const calls = vi.mocked(ledgerRepository.create).mock.calls.map((call) => call[0]);
    const debit = calls.find((entry) => entry.idempotencyKey === 'adjustment:ADJ-D');
    const credit = calls.find((entry) => entry.idempotencyKey === 'adjustment:ADJ-C');
    expect(debit?.metadata).toMatchObject({ direction: 'debit' });
    expect(credit?.metadata).toMatchObject({ direction: 'credit' });
    expect(wallet.availablePesewas).toBe(19_500);
  });

  it('rejects withdrawals above available balance or without a payout destination', async () => {
    await creditDeposit(200);
    vi.mocked(payoutMethodRepository.findById).mockResolvedValue(null);
    await expect(walletService.requestWithdrawal(userId, 50, payoutMethodId)).rejects.toBeInstanceOf(
      ValidationError,
    );

    vi.mocked(payoutMethodRepository.findById).mockResolvedValue({
      _id: payoutMethodId,
      mechanic: mechanicId,
      kind: 'bank',
      label: 'GCB',
      accountName: 'Kwame',
      accountNumber: '1234567890',
      verified: true,
      active: true,
    } as never);
    await expect(walletService.requestWithdrawal(userId, 500, payoutMethodId)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(wallet.availablePesewas).toBe(20_000);
  });

  it('does not allow concurrent approvals to spend the same funds', async () => {
    await creditDeposit(50);
    vi.mocked(payoutMethodRepository.findById).mockResolvedValue({
      _id: payoutMethodId,
      mechanic: mechanicId,
      kind: 'bank',
      label: 'GCB',
      accountName: 'Kwame',
      accountNumber: '1234567890',
      verified: true,
      active: true,
    } as never);
    const stored = new Map<string, Record<string, unknown>>();
    let created = 0;
    vi.mocked(withdrawalRepository.create).mockImplementation(async (data) => {
      created += 1;
      const id = created === 1 ? 'wdr-a' : 'wdr-b';
      const doc = {
        ...data,
        _id: { toString: () => id },
        save: async function save(this: Record<string, unknown>) {
          Object.assign(stored.get(id) as object, this);
        },
        notifiedEvents: [],
      };
      stored.set(id, doc);
      return doc as never;
    });
    vi.mocked(withdrawalRepository.findById).mockImplementation(async (id) => {
      return (stored.get(id) ?? null) as never;
    });

    await walletService.requestWithdrawal(userId, 40, payoutMethodId);
    await walletService.requestWithdrawal(userId, 40, payoutMethodId);
    expect(wallet.availablePesewas).toBe(5_000);
    expect(wallet.reservedPesewas).toBe(0);

    await walletService.approveWithdrawal(adminId, 'wdr-a');
    await expect(walletService.approveWithdrawal(adminId, 'wdr-b')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(wallet.availablePesewas).toBe(1_000);
    expect(wallet.reservedPesewas).toBe(4_000);
    expect((stored.get('wdr-b') as { status: string }).status).toBe('pending');
  });

  it('records ledger-backed adjustments without overwriting balances', async () => {
    await creditDeposit(200);
    await walletService.adjust(adminId, mechanicId, {
      amountGhs: -15,
      reason: 'Manual correction',
      reference: 'ADJ-1',
    });
    await walletService.adjust(adminId, mechanicId, {
      amountGhs: -15,
      reason: 'Manual correction',
      reference: 'ADJ-1',
    });
    expect(wallet.availablePesewas).toBe(18_500);
  });

  it('rejects an adjustment that would create a negative available balance', async () => {
    await expect(
      walletService.adjust(adminId, mechanicId, { amountGhs: -20, reason: 'Too large' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('credits job earnings as pending until settlement, then as available', async () => {
    await walletService.creditPendingEarning({
      mechanicId,
      amountPesewas: 18_000,
      paymentId: 'pay1',
      requestId,
      paystackReference: 'RR_JOB_1',
    });
    expect(wallet.pendingPesewas).toBe(18_000);
    expect(wallet.earningsAvailablePesewas).toBe(0);
    expect(wallet.availablePesewas).toBe(0);

    await walletService.settleServiceEarning({
      mechanicId,
      amountPesewas: 18_000,
      paymentId: 'pay1',
      settlementId: 'set1',
      adminUserId: adminId,
    });
    expect(wallet.pendingPesewas).toBe(0);
    expect(wallet.earningsAvailablePesewas).toBe(18_000);
  });

  it('withdraws settled service earnings without touching prepaid deposits', async () => {
    await creditDeposit(200);
    wallet.earningsAvailablePesewas = 18_000;
    vi.mocked(payoutMethodRepository.findById).mockResolvedValue({
      _id: payoutMethodId,
      mechanic: mechanicId,
      kind: 'mobile_money',
      label: 'MTN MoMo',
      accountName: 'Kwame',
      accountNumber: '0241234567',
      network: 'mtn',
      verified: true,
      active: true,
    } as never);
    let stored: Record<string, unknown> | null = null;
    vi.mocked(withdrawalRepository.create).mockImplementation(async (data) => {
      stored = {
        ...data,
        _id: { toString: () => 'wdr-earn' },
        save: async function save(this: Record<string, unknown>) {
          Object.assign(stored as object, this);
        },
        notifiedEvents: [],
      };
      return stored as never;
    });
    vi.mocked(withdrawalRepository.findById).mockImplementation(async () => stored as never);

    await walletService.requestWithdrawal(userId, 100, payoutMethodId, 'service_earnings');
    expect(wallet.earningsAvailablePesewas).toBe(18_000);
    expect(wallet.availablePesewas).toBe(20_000);
    expect(wallet.reservedPesewas).toBe(0);
    expect(stored?.sourceType).toBe('service_earnings');

    await walletService.approveWithdrawal(adminId, 'wdr-earn');
    expect(wallet.earningsAvailablePesewas).toBe(8_000);
    expect(wallet.availablePesewas).toBe(20_000);
    expect(wallet.reservedPesewas).toBe(10_000);
  });

  it('rejects a service-earnings withdrawal against unconfirmed pending funds', async () => {
    wallet.pendingPesewas = 18_000;
    vi.mocked(payoutMethodRepository.findById).mockResolvedValue({
      _id: payoutMethodId,
      mechanic: mechanicId,
      kind: 'bank',
      label: 'GCB',
      accountName: 'Kwame',
      accountNumber: '1234567890',
      verified: true,
      active: true,
    } as never);
    await expect(
      walletService.requestWithdrawal(userId, 50, payoutMethodId, 'service_earnings'),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(wallet.pendingPesewas).toBe(18_000);
    expect(wallet.reservedPesewas).toBe(0);
  });

  it('saves payout destinations unverified until an admin verifies them', async () => {
    vi.mocked(payoutMethodRepository.create).mockImplementation(async (data) => ({
      ...data,
      _id: { toString: () => payoutMethodId },
    }) as never);
    const created = await walletService.addPayoutMethod(userId, {
      kind: 'mobile_money',
      label: 'MTN',
      accountName: 'Kwame',
      accountNumber: '0241234567',
      network: 'mtn',
    });
    expect(vi.mocked(payoutMethodRepository.create).mock.calls[0][0].verified).toBe(true);
    expect(created.accountLast4).toBe('4567');
  });
});

describe('wallet authorization helpers', () => {
  it('identifies wallet Paystack references', async () => {
    const { isWalletDepositReference } = await import('../services/wallet.service.js');
    expect(isWalletDepositReference('RR_PWAL_abc')).toBe(true);
    expect(isWalletDepositReference('RR_PSUB_abc')).toBe(false);
  });
});
