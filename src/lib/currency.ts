/** Format Ghana Cedis amounts for display. */
export function formatGhs(amount: number, fractionDigits?: number): string {
  const digits =
    fractionDigits ?? (Number.isInteger(amount) ? 0 : 2);
  return `₵${amount.toLocaleString('en-GH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Finance-grade Ghana Cedis: always two decimals, e.g. GH₵1,250.00 or −GH₵10.00. */
export function formatCedis(amount: number): string {
  const value = Math.abs(amount).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '−' : ''}GH₵${value}`;
}
