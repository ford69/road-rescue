/** Format Ghana Cedis amounts for display. */
export function formatGhs(amount: number, fractionDigits?: number): string {
  const digits =
    fractionDigits ?? (Number.isInteger(amount) ? 0 : 2);
  return `₵${amount.toLocaleString('en-GH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
