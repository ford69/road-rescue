import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: { PROVIDER_COMMISSION_PERCENT: 10 },
}));

vi.mock('../repositories/finance.repository.js', () => ({
  financeRepository: {
    completedDeposits: vi.fn(),
    paidJobPayments: vi.fn(),
    ledgerTotal: vi.fn(),
    directJobValue: vi.fn(),
    confirmedSettlements: vi.fn(),
    withdrawals: vi.fn(),
    completedWithdrawals: vi.fn(),
    walletTotals: vi.fn(),
    findDeposits: vi.fn(),
    findPayments: vi.fn(),
    findLedger: vi.fn(),
    findWithdrawals: vi.fn(),
  },
}));

vi.mock('../services/settlement.service.js', () => ({
  settlementService: { awaitingSummary: vi.fn() },
}));

vi.mock('../services/corporate-cash.service.js', () => ({
  corporateCashService: { snapshot: vi.fn() },
}));

import { financeRepository } from '../repositories/finance.repository.js';
import { settlementService } from '../services/settlement.service.js';
import { corporateCashService } from '../services/corporate-cash.service.js';
import { financeReportService, parseRange } from '../services/finance-report.service.js';
import { ValidationError } from '../utils/errors.js';

const totals = (totalPesewas: number, count: number) => ({ totalPesewas, count });
const NONE = totals(0, 0);
const now = new Date('2026-11-09T12:00:00Z');

function stubSummary() {
  vi.mocked(financeRepository.completedDeposits).mockResolvedValue(totals(50_000, 2));
  vi.mocked(financeRepository.paidJobPayments).mockResolvedValue({ gross: NONE, fees: NONE });
  vi.mocked(financeRepository.ledgerTotal).mockImplementation(async (types) =>
    types.includes('commission_deduction') ? totals(3_000, 2) : totals(1_000, 1),
  );
  vi.mocked(financeRepository.directJobValue).mockResolvedValue(totals(30_000, 2));
  vi.mocked(financeRepository.confirmedSettlements).mockResolvedValue(totals(40_000, 1));
  vi.mocked(financeRepository.completedWithdrawals).mockResolvedValue(totals(5_000, 1));
  vi.mocked(financeRepository.walletTotals).mockResolvedValue({
    available: 30_000,
    earningsAvailable: 0,
    pending: 0,
    reserved: 4_000,
    providers: 2,
  });
  vi.mocked(financeRepository.withdrawals).mockImplementation(async (match) => {
    if (match.status === 'pending') return totals(2_500, 1);
    if (match.status === 'failed') return NONE;
    return totals(1_000, 1);
  });
  vi.mocked(settlementService.awaitingSummary).mockResolvedValue({
    unsettledCount: 1,
    unsettledPesewas: 10_000,
    openBatchCount: 0,
    openBatchPesewas: 0,
    discrepancyCount: 0,
    discrepancyPesewas: 0,
  });
  vi.mocked(corporateCashService.snapshot).mockResolvedValue({
    unallocatedPayoutCashGhs: 300,
    settledGhs: 400,
    allocatedGhs: 10,
    paidGhs: 50,
    committedGhs: 40,
  } as never);
}

describe('finance date ranges', () => {
  it('defaults to the last 30 days', () => {
    const range = parseRange({}, now);
    expect(range.to).toEqual(now);
    expect(now.getTime() - range.from.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('rejects invalid or reversed ranges', () => {
    expect(() => parseRange({ from: 'yesterday' }, now)).toThrow(ValidationError);
    expect(() => parseRange({ from: '2026-11-09', to: '2026-11-01' }, now)).toThrow(ValidationError);
  });
});

describe('finance summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const find of [
      financeRepository.findDeposits,
      financeRepository.findPayments,
      financeRepository.findLedger,
      financeRepository.findWithdrawals,
    ]) {
      vi.mocked(find).mockResolvedValue([[], 0] as never);
    }
    stubSummary();
  });

  it('reports each card from its own source without double counting', async () => {
    const summary = await financeReportService.summary({}, now);

    expect(summary.commissionPercent).toBe(10);
    expect(summary.collected.totalGhs).toBe(500);
    expect(summary.collected.confirmedBankReceiptsGhs).toBe(400);
    expect(summary.collected.directCustomerPaymentsGhs).toBe(300);

    expect(summary.providerEarnings.availableGhs).toBe(300);
    expect(summary.providerEarnings.setAsideGhs).toBe(40);
    expect(summary.providerEarnings.setAsideForWithdrawalsGhs).toBe(35);
    expect(summary.providerEarnings.setAsideForActiveJobsGhs).toBe(5);
    expect(summary.providerEarnings.totalGhs).toBe(340);

    expect(summary.roadRescueEarnings.totalGhs).toBe(20);
    expect(summary.roadRescueEarnings.commissionReversedGhs).toBe(10);

    expect(summary.awaitingSettlement.totalGhs).toBe(100);
    expect(summary.providerPayments.totalGhs).toBe(50);
    expect(summary.providerPayments.count).toBe(1);
    expect(summary.providerPayments.inProgressGhs).toBe(10);
    expect(summary.companyFunds.availableGhs).toBe(300);
    expect(financeRepository.findDeposits).toHaveBeenCalled();
  });

  it('only counts completed payouts and confirmed settlements in the date range', async () => {
    await financeReportService.summary({ from: '2026-11-01', to: '2026-11-09' }, now);
    const [range] = vi.mocked(financeRepository.completedWithdrawals).mock.calls[0];
    expect(range.from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(vi.mocked(financeRepository.confirmedSettlements).mock.calls[0][0]).toBe(range);
  });

  it('loads recent activity inside the selected date range', async () => {
    await financeReportService.summary(
      { from: '2026-11-01T00:00:00.000Z', to: '2026-11-09T12:00:00.000Z' },
      now,
    );
    const filter = vi.mocked(financeRepository.findDeposits).mock.calls[0][0] as {
      createdAt: { $gte: Date; $lte: Date };
    };
    expect(filter.createdAt.$gte.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(filter.createdAt.$lte.toISOString()).toBe('2026-11-09T12:00:00.000Z');
  });

  it('lists only the actions that need attention', async () => {
    const summary = await financeReportService.summary({}, now);
    expect(summary.needsAttention.map((item) => item.id)).toEqual([
      'settlements_pending',
      'withdrawals_pending',
      'payouts_in_progress',
    ]);
    expect(summary.needsAttention[1]).toMatchObject({ count: 1, amountGhs: 25 });
  });

  it('returns no attention items when everything is settled', async () => {
    vi.mocked(financeRepository.withdrawals).mockResolvedValue(NONE);
    vi.mocked(settlementService.awaitingSummary).mockResolvedValue({
      unsettledCount: 0,
      unsettledPesewas: 0,
      openBatchCount: 0,
      openBatchPesewas: 0,
      discrepancyCount: 0,
      discrepancyPesewas: 0,
    });
    const summary = await financeReportService.summary({}, now);
    expect(summary.needsAttention).toEqual([]);
  });
});

describe('finance transactions', () => {
  const at = (iso: string) => new Date(iso);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(financeRepository.findDeposits).mockResolvedValue([
      [
        {
          _id: 'dep1',
          reference: 'RR_PWAL_1',
          paystackReference: 'RR_PWAL_1',
          mechanic: { _id: 'mech1', garageName: 'Kwame Auto' },
          amountPesewas: 20_000,
          status: 'completed',
          channel: 'mobile_money',
          createdAt: at('2026-11-05T10:00:00Z'),
          paidAt: at('2026-11-05T10:00:00Z'),
        },
      ],
      1,
    ] as never);
    vi.mocked(financeRepository.findPayments).mockResolvedValue([[], 0] as never);
    vi.mocked(financeRepository.findLedger).mockResolvedValue([
      [
        {
          _id: 'led1',
          reference: 'COMM-1',
          type: 'commission_deduction',
          mechanic: { _id: 'mech1', garageName: 'Kwame Auto' },
          amountPesewas: 2_000,
          status: 'completed',
          createdAt: at('2026-11-07T10:00:00Z'),
          metadata: { serviceAmountGhs: 200, percent: 10 },
        },
      ],
      1,
    ] as never);
    vi.mocked(financeRepository.findWithdrawals).mockResolvedValue([
      [
        {
          _id: 'wdr1',
          reference: 'WDR-1',
          mechanic: { _id: 'mech1', garageName: 'Kwame Auto' },
          amountPesewas: 5_000,
          status: 'pending',
          destinationSnapshot: { kind: 'mobile_money', label: 'MTN', accountLast4: '4321' },
          createdAt: at('2026-11-06T10:00:00Z'),
        },
      ],
      1,
    ] as never);
  });

  it('merges every source newest first with a combined total', async () => {
    const result = await financeReportService.listTransactions({ page: '1', limit: '10' });
    expect(result.items.map((row) => row.reference)).toEqual(['COMM-1', 'WDR-1', 'RR_PWAL_1']);
    expect(result.total).toBe(3);
    const commission = result.items[0];
    expect(commission).toMatchObject({ type: 'commission', amountGhs: 20, commissionGhs: 20 });
    expect(commission.details['Job value']).toBe(200);
    expect(result.items[1].details.Destination).toBe('MTN ·••4321');
  });

  it('pages across the merged list', async () => {
    const result = await financeReportService.listTransactions({ page: '2', limit: '2' });
    expect(result.items.map((row) => row.reference)).toEqual(['RR_PWAL_1']);
  });

  it('queries only the sources that match the type filter', async () => {
    await financeReportService.listTransactions({ type: 'provider_withdrawal', status: 'pending' });
    expect(financeRepository.findWithdrawals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
      expect.any(Number),
    );
    expect(financeRepository.findDeposits).not.toHaveBeenCalled();
    expect(financeRepository.findLedger).not.toHaveBeenCalled();
  });

  it('skips sources that cannot have the chosen method or status', async () => {
    await financeReportService.listTransactions({ method: 'card' });
    expect(financeRepository.findWithdrawals).not.toHaveBeenCalled();
    expect(financeRepository.findLedger).not.toHaveBeenCalled();
    expect(financeRepository.findDeposits).toHaveBeenCalledWith(
      expect.objectContaining({ channel: { $in: ['card'] } }),
      expect.any(Number),
    );
  });

  it('rejects unknown filters', async () => {
    await expect(financeReportService.listTransactions({ type: 'bonus' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
