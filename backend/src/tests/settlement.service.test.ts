import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ValidationError } from '../utils/errors.js';

vi.mock('../config/env.js', () => ({
  env: {
    PROVIDER_COMMISSION_PERCENT: 10,
  },
}));

vi.mock('../repositories/misc.repository.js', () => ({
  paymentRepository: {
    findById: vi.fn(),
    findAwaitingSettlement: vi.fn(),
    claimForSettlement: vi.fn(),
  },
}));

vi.mock('../repositories/wallet.repository.js', () => ({
  depositRepository: {
    findById: vi.fn(),
    findAwaitingSettlement: vi.fn(),
    claimForSettlement: vi.fn(),
  },
  settlementBatchRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByReference: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    findOpen: vi.fn(),
    transitionStatus: vi.fn(),
  },
  corporateTreasuryRepository: {
    ensure: vi.fn(),
    incrementIf: vi.fn(),
  },
  corporateLedgerRepository: {
    create: vi.fn(),
    findRecent: vi.fn(),
  },
  walletRepository: {},
  ledgerRepository: {},
  payoutMethodRepository: {},
  withdrawalRepository: {},
  walletAuditRepository: {},
}));

vi.mock('../services/wallet.service.js', () => ({
  walletService: {
    settleServiceEarning: vi.fn(),
  },
}));

import { paymentRepository } from '../repositories/misc.repository.js';
import {
  corporateLedgerRepository,
  corporateTreasuryRepository,
  depositRepository,
  settlementBatchRepository,
} from '../repositories/wallet.repository.js';
import { walletService } from '../services/wallet.service.js';
import { corporateCashService } from '../services/corporate-cash.service.js';
import { settlementService } from '../services/settlement.service.js';

const adminId = '64a0000000000000000000aa';
const paymentId = '64a0000000000000000000bb';
const mechanicId = '64a0000000000000000000cc';
const batchId = '64a0000000000000000000dd';

describe('corporate cash availability', () => {
  let treasury: {
    settledPesewas: number;
    allocatedPesewas: number;
    paidPesewas: number;
    committedPesewas: number;
    version: number;
  };
  let ledgerKeys: Set<string>;

  beforeEach(() => {
    vi.clearAllMocks();
    treasury = {
      settledPesewas: 0,
      allocatedPesewas: 0,
      paidPesewas: 0,
      committedPesewas: 0,
      version: 0,
    };
    ledgerKeys = new Set();
    vi.mocked(corporateTreasuryRepository.ensure).mockImplementation(async () => treasury as never);
    vi.mocked(corporateTreasuryRepository.incrementIf).mockImplementation(async (filter, inc) => {
      const allocatedGte = (filter.allocatedPesewas as { $gte?: number } | undefined)?.$gte;
      if (allocatedGte !== undefined && treasury.allocatedPesewas < allocatedGte) return null;
      if (filter.$expr) {
        const unallocated =
          treasury.settledPesewas -
          treasury.allocatedPesewas -
          treasury.paidPesewas -
          treasury.committedPesewas;
        const needed = Number(inc.allocatedPesewas ?? 0);
        if (unallocated < needed) return null;
      }
      for (const [key, delta] of Object.entries(inc)) {
        (treasury as unknown as Record<string, number>)[key] =
          ((treasury as unknown as Record<string, number>)[key] ?? 0) + delta;
      }
      treasury.version += 1;
      return treasury as never;
    });
    vi.mocked(corporateLedgerRepository.create).mockImplementation(async (data) => {
      const key = String(data.idempotencyKey);
      if (ledgerKeys.has(key)) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      ledgerKeys.add(key);
      return data as never;
    });
  });

  it('blocks payout allocation until settled cash exists', async () => {
    await expect(
      corporateCashService.allocatePayout({
        adminUserId: adminId,
        amountPesewas: 10_000,
        withdrawalId: 'w1',
        description: 'test',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('allocates, completes, and never double-counts a payout', async () => {
    await corporateCashService.creditSettlement({
      adminUserId: adminId,
      amountPesewas: 20_000,
      description: 'Bank receipt',
      idempotencyKey: 'settlement_received:s1',
      settlementId: 's1',
    });
    await corporateCashService.allocatePayout({
      adminUserId: adminId,
      amountPesewas: 10_000,
      withdrawalId: 'w1',
      description: 'allocate',
    });
    expect(treasury.allocatedPesewas).toBe(10_000);
    await corporateCashService.completePayout({
      adminUserId: adminId,
      amountPesewas: 10_000,
      withdrawalId: 'w1',
      description: 'paid',
    });
    await corporateCashService.completePayout({
      adminUserId: adminId,
      amountPesewas: 10_000,
      withdrawalId: 'w1',
      description: 'paid',
    });
    expect(treasury.allocatedPesewas).toBe(0);
    expect(treasury.paidPesewas).toBe(10_000);
    const snap = await corporateCashService.snapshot();
    expect(snap.unallocatedPayoutCashPesewas).toBe(10_000);
  });
});

describe('settlement batches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(paymentRepository.findAwaitingSettlement).mockResolvedValue([] as never);
    vi.mocked(depositRepository.findAwaitingSettlement).mockResolvedValue([] as never);
    vi.mocked(settlementBatchRepository.findByReference).mockResolvedValue(null);
    vi.mocked(settlementBatchRepository.findOpen).mockResolvedValue([] as never);
    vi.mocked(settlementBatchRepository.transitionStatus).mockImplementation(async (id, from, set) => {
      const current = (await settlementBatchRepository.findById(id)) as unknown as
        | (Record<string, unknown> & { status: string })
        | null;
      if (!current || !from.includes(current.status as never)) return null as never;
      Object.assign(current, set);
      return current as never;
    });
  });

  it('lists unpaid Paystack job charges awaiting bank settlement', async () => {
    vi.mocked(paymentRepository.findAwaitingSettlement).mockResolvedValue([
      {
        _id: { toString: () => paymentId },
        mechanic: mechanicId,
        request: 'req1',
        transactionReference: 'RR_JOB_1',
        grossAmount: 200,
        platformFee: 20,
        providerAmount: 180,
        paidAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
      },
    ] as never);
    const result = await settlementService.listAwaiting({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.entitlementGhs).toBe(180);
    expect(result.items[0]?.kind).toBe('job_payment');
  });

  it('confirms a settlement once and releases provider entitlements', async () => {
    const batch = {
      _id: { toString: () => batchId },
      reference: 'RR_SET_1',
      settlementReference: 'PAYSTACK-SET-1',
      amountReceivedPesewas: 20_000,
      currency: 'GHS',
      settlementDate: new Date(),
      status: 'draft',
      items: [
        {
          kind: 'job_payment',
          payment: paymentId,
          mechanic: mechanicId,
          amountPesewas: 20_000,
          entitlementPesewas: 18_000,
        },
      ],
      save: vi.fn(),
    };
    vi.mocked(settlementBatchRepository.findById).mockResolvedValue(batch as never);
    vi.mocked(paymentRepository.claimForSettlement).mockResolvedValue({ _id: paymentId } as never);
    vi.mocked(corporateTreasuryRepository.ensure).mockResolvedValue({
      settledPesewas: 0,
      allocatedPesewas: 0,
      paidPesewas: 0,
      committedPesewas: 0,
    } as never);
    vi.mocked(corporateTreasuryRepository.incrementIf).mockResolvedValue({
      settledPesewas: 20_000,
      allocatedPesewas: 0,
      paidPesewas: 0,
      committedPesewas: 0,
    } as never);
    vi.mocked(corporateLedgerRepository.create).mockResolvedValue({} as never);

    const confirmed = await settlementService.confirm(adminId, batchId);
    expect(paymentRepository.claimForSettlement).toHaveBeenCalledWith(paymentId, batchId);
    expect(walletService.settleServiceEarning).toHaveBeenCalledWith(
      expect.objectContaining({
        mechanicId,
        amountPesewas: 18_000,
        paymentId,
      }),
    );
    expect(confirmed.status).toBe('confirmed');

    const again = await settlementService.confirm(adminId, batchId);
    expect(again.status).toBe('confirmed');
    expect(walletService.settleServiceEarning).toHaveBeenCalledTimes(1);
    expect(corporateLedgerRepository.create).toHaveBeenCalledTimes(1);
  });
});

describe('settlement reconciliation', () => {
  const depositId = '64a0000000000000000000ee';
  let treasurySettled: number;
  let ledgerKeys: Set<string>;
  let stored: Record<string, unknown> & { status: string; save: () => Promise<void> };

  beforeEach(() => {
    vi.clearAllMocks();
    treasurySettled = 0;
    ledgerKeys = new Set();
    vi.mocked(settlementBatchRepository.findByReference).mockResolvedValue(null);
    vi.mocked(settlementBatchRepository.findOpen).mockResolvedValue([] as never);
    vi.mocked(depositRepository.findById).mockResolvedValue({
      _id: { toString: () => depositId },
      mechanic: mechanicId,
      amountPesewas: 20_000,
      status: 'completed',
      settlementStatus: 'pending',
    } as never);
    vi.mocked(depositRepository.claimForSettlement).mockResolvedValue({ _id: depositId } as never);
    vi.mocked(settlementBatchRepository.create).mockImplementation(async (data) => {
      stored = {
        ...data,
        _id: { toString: () => batchId },
        createdAt: new Date(),
        save: async () => undefined,
      } as never;
      return stored as never;
    });
    vi.mocked(settlementBatchRepository.findById).mockImplementation(async () => stored as never);
    vi.mocked(settlementBatchRepository.transitionStatus).mockImplementation(async (_id, from, set) => {
      if (!from.includes(stored.status as never)) return null as never;
      Object.assign(stored, set);
      return stored as never;
    });
    vi.mocked(corporateTreasuryRepository.ensure).mockResolvedValue({
      settledPesewas: 0,
      allocatedPesewas: 0,
      paidPesewas: 0,
      committedPesewas: 0,
    } as never);
    vi.mocked(corporateTreasuryRepository.incrementIf).mockImplementation(async (_filter, inc) => {
      treasurySettled += Number(inc.settledPesewas ?? 0);
      return {
        settledPesewas: treasurySettled,
        allocatedPesewas: 0,
        paidPesewas: 0,
        committedPesewas: 0,
      } as never;
    });
    vi.mocked(corporateLedgerRepository.create).mockImplementation(async (data) => {
      const key = String(data.idempotencyKey);
      if (ledgerKeys.has(key)) throw Object.assign(new Error('duplicate'), { code: 11000 });
      ledgerKeys.add(key);
      return data as never;
    });
  });

  const base = {
    settlementReference: 'PSTK-SET-9',
    settlementDate: '2026-11-08',
    depositIds: [depositId],
    confirm: true,
  };

  it('confirms when the bank receipt equals the expected amount after Paystack fees', async () => {
    const result = await settlementService.create(adminId, {
      ...base,
      amountReceivedGhs: 196.1,
      paystackFeesGhs: 3.9,
    });
    expect(result.status).toBe('confirmed');
    expect(result.expectedNetGhs).toBe(196.1);
    expect(result.discrepancyGhs).toBe(0);
    expect(treasurySettled).toBe(19_610);
  });

  it('flags a mismatch without crediting company funds or settling transactions', async () => {
    const result = await settlementService.create(adminId, { ...base, amountReceivedGhs: 150 });
    expect(result.status).toBe('discrepancy');
    expect(result.discrepancyGhs).toBe(-50);
    expect(treasurySettled).toBe(0);
    expect(depositRepository.claimForSettlement).not.toHaveBeenCalled();
    await expect(settlementService.confirm(adminId, batchId)).rejects.toBeInstanceOf(ValidationError);
  });

  it('requires a written explanation before accepting a difference', async () => {
    await settlementService.create(adminId, { ...base, amountReceivedGhs: 150 });
    await expect(
      settlementService.resolve(adminId, batchId, { acceptDifference: true, note: 'short' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(stored.status).toBe('discrepancy');

    const accepted = await settlementService.resolve(adminId, batchId, {
      acceptDifference: true,
      note: 'Paystack held ₵50 for a chargeback dispute on this batch.',
    });
    expect(accepted.status).toBe('confirmed');
    expect(accepted.discrepancyGhs).toBe(-50);
    expect(accepted.resolutionNote).toContain('chargeback');
    expect(treasurySettled).toBe(15_000);
  });

  it('confirms once the administrator corrects a mistyped amount', async () => {
    await settlementService.create(adminId, { ...base, amountReceivedGhs: 20 });
    const corrected = await settlementService.resolve(adminId, batchId, { amountReceivedGhs: 200 });
    expect(corrected.status).toBe('confirmed');
    expect(treasurySettled).toBe(20_000);
  });

  it('never credits the same settlement twice', async () => {
    await settlementService.create(adminId, { ...base, amountReceivedGhs: 200 });
    stored.status = 'draft';
    await settlementService.finalize(adminId, stored as never);
    expect(treasurySettled).toBe(20_000);
    await expect(
      settlementService.resolve(adminId, batchId, { amountReceivedGhs: 200 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuses transactions already held in a settlement under review', async () => {
    vi.mocked(settlementBatchRepository.findOpen).mockResolvedValue([
      { status: 'discrepancy', items: [{ deposit: depositId }] },
    ] as never);
    await expect(
      settlementService.create(adminId, { ...base, amountReceivedGhs: 200 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
