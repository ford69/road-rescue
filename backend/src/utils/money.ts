/** Integer Ghana pesewas. 100 pesewas = ₵1. Never use floats for ledger math. */

export const PESEWAS_PER_GHS = 100;

export function ghsToPesewas(ghs: number): number {
  if (!Number.isFinite(ghs)) return 0;
  return Math.round(ghs * PESEWAS_PER_GHS);
}

export function pesewasToGhs(pesewas: number): number {
  return pesewas / PESEWAS_PER_GHS;
}

export function commissionPesewas(servicePesewas: number, ratePercent: number): number {
  if (servicePesewas <= 0 || ratePercent <= 0) return 0;
  return Math.round((servicePesewas * ratePercent) / 100);
}

export function addGhs(amounts: number[]): number {
  return pesewasToGhs(amounts.reduce((sum, amount) => sum + ghsToPesewas(amount), 0));
}

export function multiplyGhs(amount: number, factor: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(factor) || factor <= 0) return 0;
  return pesewasToGhs(Math.round(ghsToPesewas(amount) * factor));
}

export function assertPositivePesewas(amount: number, label = 'Amount'): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`${label} must be a positive integer in pesewas`);
  }
}
