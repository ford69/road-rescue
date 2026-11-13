import { describe, expect, it } from 'vitest';
import { addGhs, commissionPesewas, ghsToPesewas, pesewasToGhs } from '../utils/money.js';

describe('money helpers', () => {
  it('converts GHS to integer pesewas without float remainder', () => {
    expect(ghsToPesewas(200)).toBe(20_000);
    expect(ghsToPesewas(150)).toBe(15_000);
    expect(ghsToPesewas(0.1)).toBe(10);
    expect(pesewasToGhs(15_000)).toBe(150);
  });

  it('calculates 10% commission on GH₵150 as GH₵15', () => {
    expect(commissionPesewas(ghsToPesewas(150), 10)).toBe(1_500);
    expect(pesewasToGhs(1_500)).toBe(15);
  });

  it('does not deduct commission for a zero or invalid service amount', () => {
    expect(commissionPesewas(0, 10)).toBe(0);
    expect(commissionPesewas(ghsToPesewas(150), 0)).toBe(0);
  });

  it('adds GHS amounts in integer pesewas', () => {
    expect(addGhs([100, 20, 0.1])).toBe(120.1);
  });
});
