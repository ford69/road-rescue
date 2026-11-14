export type FinancePreset = 'today' | '7d' | '30d' | 'month' | 'custom';

export const FINANCE_PRESETS: Array<{ id: FinancePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

export function isFinancePreset(value: string | null): value is FinancePreset {
  return FINANCE_PRESETS.some((item) => item.id === value);
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function isoDate(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function rangeForPreset(
  preset: FinancePreset,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): { from: string; to: string } {
  if (preset === 'custom' && customFrom && customTo) {
    return {
      from: startOfLocalDay(new Date(`${customFrom}T00:00:00`)).toISOString(),
      to: endOfLocalDay(new Date(`${customTo}T00:00:00`)).toISOString(),
    };
  }
  let from = startOfLocalDay(now);
  if (preset === '7d') from = startOfLocalDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  if (preset === '30d') from = startOfLocalDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
  if (preset === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: from.toISOString(), to: endOfLocalDay(now).toISOString() };
}
