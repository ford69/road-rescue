import crypto from 'node:crypto';
import type { ISettlementBatch } from '../models/SettlementBatch.js';
import { paymentRepository } from '../repositories/misc.repository.js';
import {
  depositRepository,
  settlementBatchRepository,
} from '../repositories/wallet.repository.js';
import { corporateCashService } from './corporate-cash.service.js';
import { walletService } from './wallet.service.js';
import { ghsToPesewas, pesewasToGhs } from '../utils/money.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { paginationMeta, parsePagination, type PaginationQuery } from '../utils/pagination.js';
import { refId } from '../utils/objectId.js';

const MIN_RESOLUTION_NOTE = 10;

function newReference(): string {
  return `RR_SET_${crypto.randomBytes(12).toString('hex')}`;
}

type BatchLike = Pick<
  ISettlementBatch,
  | 'reference'
  | 'settlementReference'
  | 'paystackReference'
  | 'bankReference'
  | 'amountReceivedPesewas'
  | 'currency'
  | 'settlementDate'
  | 'status'
  | 'notes'
  | 'resolutionNote'
  | 'resolvedAt'
  | 'confirmedAt'
  | 'createdAt'
> & {
  _id: { toString(): string };
  expectedGrossPesewas?: number;
  paystackFeesPesewas?: number;
  items: Array<{
    kind: string;
    payment?: unknown;
    deposit?: unknown;
    mechanic?: unknown;
    amountPesewas: number;
    entitlementPesewas: number;
  }>;
};

/** Gross Paystack charges in the batch. Older batches stored only item amounts. */
function expectedGross(batch: Pick<BatchLike, 'items' | 'expectedGrossPesewas'>): number {
  if (batch.expectedGrossPesewas && batch.expectedGrossPesewas > 0) return batch.expectedGrossPesewas;
  return batch.items.reduce((sum, item) => sum + item.amountPesewas, 0);
}

export function settlementDifference(input: {
  expectedGrossPesewas: number;
  paystackFeesPesewas: number;
  amountReceivedPesewas: number;
}) {
  const expectedNetPesewas = input.expectedGrossPesewas - input.paystackFeesPesewas;
  return {
    expectedNetPesewas,
    discrepancyPesewas: input.amountReceivedPesewas - expectedNetPesewas,
  };
}

function serializeBatch(batch: BatchLike) {
  const gross = expectedGross(batch);
  const fees = batch.paystackFeesPesewas ?? 0;
  const { expectedNetPesewas, discrepancyPesewas } = settlementDifference({
    expectedGrossPesewas: gross,
    paystackFeesPesewas: fees,
    amountReceivedPesewas: batch.amountReceivedPesewas,
  });
  return {
    id: batch._id.toString(),
    reference: batch.reference,
    settlementReference: batch.settlementReference,
    paystackReference: batch.paystackReference,
    bankReference: batch.bankReference,
    amountReceivedGhs: pesewasToGhs(batch.amountReceivedPesewas),
    expectedGrossGhs: pesewasToGhs(gross),
    paystackFeesGhs: pesewasToGhs(fees),
    expectedNetGhs: pesewasToGhs(expectedNetPesewas),
    discrepancyGhs: pesewasToGhs(discrepancyPesewas),
    currency: batch.currency,
    settlementDate: batch.settlementDate,
    status: batch.status,
    notes: batch.notes,
    resolutionNote: batch.resolutionNote,
    resolvedAt: batch.resolvedAt,
    confirmedAt: batch.confirmedAt,
    createdAt: batch.createdAt,
    itemCount: batch.items.length,
    entitlementGhs: pesewasToGhs(
      batch.items.reduce((sum, item) => sum + item.entitlementPesewas, 0),
    ),
    items: batch.items.map((item) => ({
      kind: item.kind,
      paymentId: item.payment ? String(item.payment) : undefined,
      depositId: item.deposit ? String(item.deposit) : undefined,
      mechanicId: item.mechanic ? String(item.mechanic) : undefined,
      amountGhs: pesewasToGhs(item.amountPesewas),
      entitlementGhs: pesewasToGhs(item.entitlementPesewas),
    })),
  };
}

async function openBatchItemIds() {
  const open = await settlementBatchRepository.findOpen();
  const payments = new Set<string>();
  const deposits = new Set<string>();
  for (const batch of open ?? []) {
    for (const item of batch.items) {
      if (item.payment) payments.add(String(item.payment));
      if (item.deposit) deposits.add(String(item.deposit));
    }
  }
  return { payments, deposits };
}

export const settlementService = {
  async listAwaiting(query: { from?: string; to?: string; q?: string }) {
    const [payments, deposits, open] = await Promise.all([
      paymentRepository.findAwaitingSettlement(),
      depositRepository.findAwaitingSettlement(),
      openBatchItemIds(),
    ]);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const q = query.q?.trim().toLowerCase();

    const paymentItems = payments
      .filter((payment) => {
        if (open.payments.has(payment._id.toString())) return false;
        const at = payment.paidAt ?? payment.createdAt;
        if (from && at < from) return false;
        if (to && at > to) return false;
        if (q) {
          const ref = (payment.transactionReference ?? '').toLowerCase();
          if (!ref.includes(q) && !payment._id.toString().includes(q)) return false;
        }
        return true;
      })
      .map((payment) => ({
        id: payment._id.toString(),
        kind: 'job_payment' as const,
        reference: payment.transactionReference,
        mechanicId: payment.mechanic ? refId(payment.mechanic) : undefined,
        requestId: refId(payment.request),
        grossGhs: payment.grossAmount ?? payment.amount,
        platformFeeGhs: payment.platformFee ?? 0,
        entitlementGhs: payment.providerAmount ?? 0,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      }));

    const depositItems = deposits
      .filter((deposit) => {
        if (open.deposits.has(deposit._id.toString())) return false;
        const at = deposit.paidAt ?? deposit.createdAt;
        if (from && at < from) return false;
        if (to && at > to) return false;
        if (q) {
          const ref = `${deposit.reference} ${deposit.paystackReference}`.toLowerCase();
          if (!ref.includes(q)) return false;
        }
        return true;
      })
      .map((deposit) => ({
        id: deposit._id.toString(),
        kind: 'provider_deposit' as const,
        reference: deposit.paystackReference,
        mechanicId: refId(deposit.mechanic),
        grossGhs: pesewasToGhs(deposit.amountPesewas),
        platformFeeGhs: 0,
        entitlementGhs: 0,
        paidAt: deposit.paidAt,
        createdAt: deposit.createdAt,
      }));

    return {
      items: [...paymentItems, ...depositItems].sort((a, b) => {
        const aTime = (a.paidAt ?? a.createdAt).getTime();
        const bTime = (b.paidAt ?? b.createdAt).getTime();
        return aTime - bTime;
      }),
    };
  },

  async list(query: PaginationQuery & { status?: string }) {
    const paging = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (typeof query.status === 'string' && query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      settlementBatchRepository.list(filter, paging.skip, paging.limit),
      settlementBatchRepository.count(filter),
    ]);
    return {
      items: items.map(serializeBatch),
      ...paginationMeta(total, paging.page, paging.limit),
    };
  },

  async getById(id: string) {
    const batch = await settlementBatchRepository.findById(id);
    if (!batch) throw new NotFoundError('Settlement batch not found');
    return serializeBatch(batch);
  },

  async create(
    adminUserId: string,
    input: {
      settlementReference: string;
      amountReceivedGhs: number;
      paystackFeesGhs?: number;
      settlementDate: string;
      bankReference?: string;
      paystackReference?: string;
      notes?: string;
      paymentIds?: string[];
      depositIds?: string[];
      confirm?: boolean;
    },
  ) {
    const amountReceivedPesewas = ghsToPesewas(input.amountReceivedGhs);
    if (amountReceivedPesewas <= 0) {
      throw new ValidationError('Enter the amount confirmed in the corporate bank account');
    }
    const paystackFeesPesewas = ghsToPesewas(input.paystackFeesGhs ?? 0);
    if (paystackFeesPesewas < 0) throw new ValidationError('Paystack fees cannot be negative');
    const settlementDate = new Date(input.settlementDate);
    if (Number.isNaN(settlementDate.getTime())) {
      throw new ValidationError('Enter a valid settlement date');
    }
    const paymentIds = [...new Set(input.paymentIds ?? [])];
    const depositIds = [...new Set(input.depositIds ?? [])];
    if (paymentIds.length === 0 && depositIds.length === 0) {
      throw new ValidationError('Select at least one Paystack transaction for this settlement');
    }

    const existing = await settlementBatchRepository.findByReference(input.settlementReference.trim());
    if (existing) throw new ConflictError('A settlement with this reference already exists');

    const open = await openBatchItemIds();
    if (paymentIds.some((id) => open.payments.has(id)) || depositIds.some((id) => open.deposits.has(id))) {
      throw new ConflictError('A selected transaction is already in a settlement under review');
    }

    const items: Array<{
      kind: 'job_payment' | 'provider_deposit';
      payment?: string;
      deposit?: string;
      mechanic?: string;
      amountPesewas: number;
      entitlementPesewas: number;
    }> = [];

    for (const id of paymentIds) {
      const found = await paymentRepository.findById(id);
      if (!found || found.status !== 'paid') {
        throw new ValidationError('One of the selected payments is not a successful Paystack charge');
      }
      if (found.settlementBatch || found.settlementStatus === 'settled') {
        throw new ConflictError('A selected payment is already included in a settlement');
      }
      items.push({
        kind: 'job_payment',
        payment: found._id.toString(),
        mechanic: found.mechanic ? refId(found.mechanic) : undefined,
        amountPesewas: ghsToPesewas(found.grossAmount ?? found.amount),
        entitlementPesewas: found.entitlementPesewas || ghsToPesewas(found.providerAmount ?? 0),
      });
    }

    for (const id of depositIds) {
      const found = await depositRepository.findById(id);
      if (!found || found.status !== 'completed') {
        throw new ValidationError('One of the selected deposits is not a completed Paystack charge');
      }
      if (found.settlementBatch || found.settlementStatus === 'settled') {
        throw new ConflictError('A selected deposit is already included in a settlement');
      }
      items.push({
        kind: 'provider_deposit',
        deposit: found._id.toString(),
        mechanic: refId(found.mechanic),
        amountPesewas: found.amountPesewas,
        entitlementPesewas: 0,
      });
    }

    const expectedGrossPesewas = items.reduce((sum, item) => sum + item.amountPesewas, 0);
    if (paystackFeesPesewas > expectedGrossPesewas) {
      throw new ValidationError('Paystack fees cannot exceed the value of the selected transactions');
    }
    const { discrepancyPesewas } = settlementDifference({
      expectedGrossPesewas,
      paystackFeesPesewas,
      amountReceivedPesewas,
    });

    const batch = await settlementBatchRepository.create({
      reference: newReference(),
      settlementReference: input.settlementReference.trim(),
      paystackReference: input.paystackReference?.trim(),
      bankReference: input.bankReference?.trim(),
      amountReceivedPesewas,
      expectedGrossPesewas,
      paystackFeesPesewas,
      discrepancyPesewas,
      settlementDate,
      status: 'draft',
      notes: input.notes?.trim(),
      createdBy: adminUserId as never,
      items: items.map((item) => ({
        kind: item.kind,
        payment: item.payment as never,
        deposit: item.deposit as never,
        mechanic: item.mechanic as never,
        amountPesewas: item.amountPesewas,
        entitlementPesewas: item.entitlementPesewas,
      })),
    });

    if (input.confirm) {
      return this.confirm(adminUserId, batch._id.toString());
    }
    return serializeBatch(batch);
  },

  /**
   * Confirms a draft only when the bank receipt matches the expected net amount.
   * A mismatch moves the batch to `discrepancy`; it must then go through `resolve`.
   */
  async confirm(adminUserId: string, id: string) {
    const batch = await settlementBatchRepository.findById(id);
    if (!batch) throw new NotFoundError('Settlement batch not found');
    if (batch.status === 'confirmed') return serializeBatch(batch);
    if (batch.status === 'discrepancy') {
      throw new ValidationError(
        'This settlement does not match the expected amount. Review the difference before confirming.',
      );
    }
    const { discrepancyPesewas } = settlementDifference({
      expectedGrossPesewas: expectedGross(batch),
      paystackFeesPesewas: batch.paystackFeesPesewas ?? 0,
      amountReceivedPesewas: batch.amountReceivedPesewas,
    });
    if (discrepancyPesewas !== 0) {
      const flagged = await settlementBatchRepository.transitionStatus(id, ['draft'], {
        status: 'discrepancy',
        discrepancyPesewas,
      });
      return serializeBatch(flagged ?? batch);
    }
    return this.finalize(adminUserId, batch);
  },

  async resolve(
    adminUserId: string,
    id: string,
    input: {
      amountReceivedGhs?: number;
      paystackFeesGhs?: number;
      bankReference?: string;
      acceptDifference?: boolean;
      note?: string;
    },
  ) {
    const batch = await settlementBatchRepository.findById(id);
    if (!batch) throw new NotFoundError('Settlement batch not found');
    if (batch.status === 'confirmed') {
      throw new ConflictError('This settlement is already confirmed');
    }
    const amountReceivedPesewas =
      input.amountReceivedGhs != null ? ghsToPesewas(input.amountReceivedGhs) : batch.amountReceivedPesewas;
    const paystackFeesPesewas =
      input.paystackFeesGhs != null ? ghsToPesewas(input.paystackFeesGhs) : batch.paystackFeesPesewas ?? 0;
    if (amountReceivedPesewas <= 0) throw new ValidationError('Enter the amount received in the bank');
    if (paystackFeesPesewas < 0) throw new ValidationError('Paystack fees cannot be negative');
    const gross = expectedGross(batch);
    if (paystackFeesPesewas > gross) {
      throw new ValidationError('Paystack fees cannot exceed the value of the selected transactions');
    }
    const { discrepancyPesewas } = settlementDifference({
      expectedGrossPesewas: gross,
      paystackFeesPesewas,
      amountReceivedPesewas,
    });

    batch.amountReceivedPesewas = amountReceivedPesewas;
    batch.paystackFeesPesewas = paystackFeesPesewas;
    batch.expectedGrossPesewas = gross;
    batch.discrepancyPesewas = discrepancyPesewas;
    if (input.bankReference?.trim()) batch.bankReference = input.bankReference.trim();

    if (discrepancyPesewas === 0) {
      await batch.save();
      return this.finalize(adminUserId, batch);
    }

    const note = input.note?.trim() ?? '';
    if (!input.acceptDifference || note.length < MIN_RESOLUTION_NOTE) {
      batch.status = 'discrepancy';
      await batch.save();
      if (input.acceptDifference) {
        throw new ValidationError(
          `Explain the difference in at least ${MIN_RESOLUTION_NOTE} characters before accepting it`,
        );
      }
      return serializeBatch(batch);
    }

    batch.resolutionNote = note;
    batch.resolvedBy = adminUserId as never;
    batch.resolvedAt = new Date();
    await batch.save();
    return this.finalize(adminUserId, batch);
  },

  async finalize(adminUserId: string, batch: ISettlementBatch) {
    const id = batch._id.toString();
    for (const item of batch.items) {
      if (item.kind === 'job_payment' && item.payment) {
        const claimed = await paymentRepository.claimForSettlement(String(item.payment), id);
        if (!claimed) {
          throw new ConflictError('A selected job payment was already settled in another batch');
        }
        if (item.mechanic && item.entitlementPesewas > 0) {
          await walletService.settleServiceEarning({
            mechanicId: String(item.mechanic),
            amountPesewas: item.entitlementPesewas,
            paymentId: String(item.payment),
            settlementId: id,
            adminUserId,
          });
        }
      }
      if (item.kind === 'provider_deposit' && item.deposit) {
        const claimed = await depositRepository.claimForSettlement(String(item.deposit), id);
        if (!claimed) {
          throw new ConflictError('A selected deposit was already settled in another batch');
        }
      }
    }

    await corporateCashService.creditSettlement({
      adminUserId,
      amountPesewas: batch.amountReceivedPesewas,
      description: `Paystack settlement ${batch.settlementReference}`,
      idempotencyKey: `settlement_received:${batch.reference}`,
      settlementId: id,
    });

    const confirmed = await settlementBatchRepository.transitionStatus(id, ['draft', 'discrepancy'], {
      status: 'confirmed',
      confirmedBy: adminUserId as never,
      confirmedAt: new Date(),
    });
    if (confirmed) return serializeBatch(confirmed);
    const latest = await settlementBatchRepository.findById(id);
    return serializeBatch(latest ?? batch);
  },

  /** Unsettled Paystack charges plus open batches, used by the finance overview. */
  async awaitingSummary() {
    const [awaiting, open] = await Promise.all([
      this.listAwaiting({}),
      settlementBatchRepository.findOpen(),
    ]);
    const openBatches = open ?? [];
    const awaitingPesewas = awaiting.items.reduce((sum, item) => sum + ghsToPesewas(item.grossGhs), 0);
    const openPesewas = openBatches.reduce((sum, batch) => sum + expectedGross(batch), 0);
    const discrepancies = openBatches.filter((batch) => batch.status === 'discrepancy');
    return {
      unsettledCount: awaiting.items.length,
      unsettledPesewas: awaitingPesewas,
      openBatchCount: openBatches.length,
      openBatchPesewas: openPesewas,
      discrepancyCount: discrepancies.length,
      discrepancyPesewas: discrepancies.reduce(
        (sum, batch) => sum + Math.abs(batch.discrepancyPesewas ?? 0),
        0,
      ),
    };
  },
};
