import crypto from 'node:crypto';
import type { ICorporateTreasury } from '../models/CorporateTreasury.js';
import type { CorporateLedgerType } from '../models/CorporateCashLedger.js';
import {
  corporateLedgerRepository,
  corporateTreasuryRepository,
} from '../repositories/wallet.repository.js';
import { pesewasToGhs } from '../utils/money.js';
import { isDuplicateKeyError } from '../utils/mongoErrors.js';
import { ConflictError, ValidationError } from '../utils/errors.js';

function newReference(): string {
  return `RR_CASH_${crypto.randomBytes(12).toString('hex')}`;
}

function unallocatedPesewas(treasury: ICorporateTreasury): number {
  return Math.max(
    0,
    treasury.settledPesewas - treasury.allocatedPesewas - treasury.paidPesewas - treasury.committedPesewas,
  );
}

function serializeTreasury(treasury: ICorporateTreasury) {
  const unallocated = unallocatedPesewas(treasury);
  return {
    currency: 'GHS' as const,
    settledGhs: pesewasToGhs(treasury.settledPesewas),
    allocatedGhs: pesewasToGhs(treasury.allocatedPesewas),
    paidGhs: pesewasToGhs(treasury.paidPesewas),
    committedGhs: pesewasToGhs(treasury.committedPesewas),
    unallocatedPayoutCashGhs: pesewasToGhs(unallocated),
    settledPesewas: treasury.settledPesewas,
    allocatedPesewas: treasury.allocatedPesewas,
    paidPesewas: treasury.paidPesewas,
    committedPesewas: treasury.committedPesewas,
    unallocatedPayoutCashPesewas: unallocated,
  };
}

async function postLedger(input: {
  type: CorporateLedgerType;
  amountPesewas: number;
  direction: 'credit' | 'debit';
  description: string;
  idempotencyKey: string;
  createdBy: string;
  relatedSettlementId?: string;
  relatedWithdrawalId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await corporateLedgerRepository.create({
      reference: newReference(),
      type: input.type,
      amountPesewas: input.amountPesewas,
      direction: input.direction,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      createdBy: input.createdBy as never,
      relatedSettlement: input.relatedSettlementId as never,
      relatedWithdrawal: input.relatedWithdrawalId as never,
      metadata: input.metadata,
    });
    return { created: true };
  } catch (error) {
    if (isDuplicateKeyError(error)) return { created: false };
    throw error;
  }
}

export const corporateCashService = {
  async snapshot() {
    const treasury = await corporateTreasuryRepository.ensure();
    return serializeTreasury(treasury);
  },

  async recentActivity(limit = 30) {
    const items = await corporateLedgerRepository.findRecent(limit);
    return items.map((entry) => ({
      id: entry._id.toString(),
      reference: entry.reference,
      type: entry.type,
      direction: entry.direction,
      amountGhs: pesewasToGhs(entry.amountPesewas),
      description: entry.description,
      createdAt: entry.createdAt,
    }));
  },

  async creditSettlement(input: {
    adminUserId: string;
    amountPesewas: number;
    description: string;
    idempotencyKey: string;
    settlementId?: string;
  }) {
    if (input.amountPesewas <= 0) throw new ValidationError('Settlement amount must be greater than zero');
    const posted = await postLedger({
      type: 'settlement_received',
      amountPesewas: input.amountPesewas,
      direction: 'credit',
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      createdBy: input.adminUserId,
      relatedSettlementId: input.settlementId,
    });
    if (posted.created) {
      await corporateTreasuryRepository.ensure();
      const updated = await corporateTreasuryRepository.incrementIf({}, {
        settledPesewas: input.amountPesewas,
      });
      if (!updated) throw new ConflictError('Could not record settled cash');
      return serializeTreasury(updated);
    }
    return this.snapshot();
  },

  async allocatePayout(input: {
    adminUserId: string;
    amountPesewas: number;
    withdrawalId: string;
    description: string;
  }) {
    await corporateTreasuryRepository.ensure();
    const posted = await postLedger({
      type: 'payout_allocated',
      amountPesewas: input.amountPesewas,
      direction: 'debit',
      description: input.description,
      idempotencyKey: `payout_allocated:${input.withdrawalId}`,
      createdBy: input.adminUserId,
      relatedWithdrawalId: input.withdrawalId,
    });
    if (!posted.created) return this.snapshot();
    const updated = await corporateTreasuryRepository.incrementIf(
      {
        $expr: {
          $gte: [
            {
              $subtract: [
                { $subtract: ['$settledPesewas', '$allocatedPesewas'] },
                { $add: ['$paidPesewas', '$committedPesewas'] },
              ],
            },
            input.amountPesewas,
          ],
        },
      },
      { allocatedPesewas: input.amountPesewas },
    );
    if (!updated) {
      throw new ValidationError(
        'Confirmed corporate cash is insufficient for this payout. Record the Paystack settlement first.',
      );
    }
    return serializeTreasury(updated);
  },

  async releasePayout(input: {
    adminUserId: string;
    amountPesewas: number;
    withdrawalId: string;
    description: string;
  }) {
    const posted = await postLedger({
      type: 'payout_released',
      amountPesewas: input.amountPesewas,
      direction: 'credit',
      description: input.description,
      idempotencyKey: `payout_released:${input.withdrawalId}`,
      createdBy: input.adminUserId,
      relatedWithdrawalId: input.withdrawalId,
    });
    if (!posted.created) return this.snapshot();
    const updated = await corporateTreasuryRepository.incrementIf(
      { allocatedPesewas: { $gte: input.amountPesewas } },
      { allocatedPesewas: -input.amountPesewas },
    );
    if (!updated) throw new ConflictError('Allocated corporate cash is no longer available to release');
    return serializeTreasury(updated);
  },

  async completePayout(input: {
    adminUserId: string;
    amountPesewas: number;
    withdrawalId: string;
    description: string;
  }) {
    const posted = await postLedger({
      type: 'payout_completed',
      amountPesewas: input.amountPesewas,
      direction: 'debit',
      description: input.description,
      idempotencyKey: `payout_completed:${input.withdrawalId}`,
      createdBy: input.adminUserId,
      relatedWithdrawalId: input.withdrawalId,
    });
    if (!posted.created) return this.snapshot();
    const updated = await corporateTreasuryRepository.incrementIf(
      { allocatedPesewas: { $gte: input.amountPesewas } },
      { allocatedPesewas: -input.amountPesewas, paidPesewas: input.amountPesewas },
    );
    if (!updated) throw new ConflictError('Allocated corporate cash is no longer available to complete');
    return serializeTreasury(updated);
  },

  async recordCommitment(input: {
    adminUserId: string;
    amountGhs: number;
    reason: string;
    release?: boolean;
    reference?: string;
  }) {
    const { ghsToPesewas } = await import('../utils/money.js');
    const amountPesewas = ghsToPesewas(input.amountGhs);
    if (amountPesewas <= 0) throw new ValidationError('Commitment amount must be greater than zero');
    if (!input.reason.trim()) throw new ValidationError('A reason is required');
    await corporateTreasuryRepository.ensure();
    if (input.release) {
      const posted = await postLedger({
        type: 'other_commitment_release',
        amountPesewas,
        direction: 'credit',
        description: input.reason.trim(),
        idempotencyKey: `commitment_release:${input.reference ?? crypto.randomUUID()}`,
        createdBy: input.adminUserId,
      });
      if (posted.created) {
        const updated = await corporateTreasuryRepository.incrementIf(
          { committedPesewas: { $gte: amountPesewas } },
          { committedPesewas: -amountPesewas },
        );
        if (!updated) throw new ValidationError('No committed amount remaining to release');
        return serializeTreasury(updated);
      }
      return this.snapshot();
    }
    const posted = await postLedger({
      type: 'other_commitment',
      amountPesewas,
      direction: 'debit',
      description: input.reason.trim(),
      idempotencyKey: `commitment:${input.reference ?? crypto.randomUUID()}`,
      createdBy: input.adminUserId,
    });
    if (posted.created) {
      const updated = await corporateTreasuryRepository.incrementIf({}, { committedPesewas: amountPesewas });
      if (!updated) throw new ConflictError('Could not record the commitment');
      return serializeTreasury(updated);
    }
    return this.snapshot();
  },
};

export { unallocatedPesewas };
