/** Format Ghana Cedis amounts for display. */
export function formatGhs(amount: number): string {
  return `₵${amount.toLocaleString('en-GH')}`;
}
