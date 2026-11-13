export type FinanceTab = 'overview' | 'transactions' | 'payouts' | 'settlements';

export const FINANCE_TABS: Array<{ id: FinanceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'payouts', label: 'Provider payouts' },
  { id: 'settlements', label: 'Settlements' },
];

export function isFinanceTab(value: string | null): value is FinanceTab {
  return FINANCE_TABS.some((item) => item.id === value);
}

export function statusVariant(status: string): 'success' | 'warning' | 'critical' | 'subtle' {
  if (status === 'completed' || status === 'approved' || status === 'confirmed' || status === 'paid') {
    return 'success';
  }
  if (status === 'pending' || status === 'processing' || status === 'draft' || status === 'discrepancy') {
    return 'warning';
  }
  if (status === 'failed' || status === 'rejected' || status === 'cancelled' || status === 'refunded') {
    return 'critical';
  }
  return 'subtle';
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    confirmed: 'Confirmed',
    draft: 'Draft',
    discrepancy: 'Needs review',
    paid: 'Completed',
    refunded: 'Refunded',
  };
  return labels[status] ?? status;
}

export function typeLabel(type: string) {
  const labels: Record<string, string> = {
    customer_payment: 'Customer payment',
    provider_deposit: 'Provider deposit',
    commission: 'Commission deduction',
    provider_withdrawal: 'Provider withdrawal',
    refund: 'Refund',
    adjustment: 'Financial adjustment',
  };
  return labels[type] ?? type;
}

export function methodLabel(method: string) {
  const labels: Record<string, string> = {
    card: 'Card',
    mobile_money: 'Mobile money',
    bank: 'Bank',
    wallet: 'Wallet',
    other: 'Other',
  };
  return labels[method] ?? method;
}
