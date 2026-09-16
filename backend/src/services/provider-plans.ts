export type ProviderPlanSlug =
  | 'provider_monthly'
  | 'provider_quarterly'
  | 'provider_semiannual'
  | 'provider_annual';

export interface ProviderPlanDefinition {
  slug: ProviderPlanSlug;
  name: string;
  intervalLabel: string;
  intervalMonths: number;
  priceGhs: number;
  equivalentMonthlyGhs: number;
  trialDays: number;
  description: string;
  sortOrder: number;
}

export const PROVIDER_PLANS: ProviderPlanDefinition[] = [
  {
    slug: 'provider_monthly',
    name: 'Monthly',
    intervalLabel: 'month',
    intervalMonths: 1,
    priceGhs: 49.99,
    equivalentMonthlyGhs: 49.99,
    trialDays: 30,
    description: 'Full provider access billed every month after a 30-day trial.',
    sortOrder: 1,
  },
  {
    slug: 'provider_quarterly',
    name: '3 months',
    intervalLabel: '3 months',
    intervalMonths: 3,
    priceGhs: 129.99,
    equivalentMonthlyGhs: 43.33,
    trialDays: 30,
    description: 'Save versus monthly — billed every 3 months after a 30-day trial.',
    sortOrder: 2,
  },
  {
    slug: 'provider_semiannual',
    name: '6 months',
    intervalLabel: '6 months',
    intervalMonths: 6,
    priceGhs: 229.99,
    equivalentMonthlyGhs: 38.33,
    trialDays: 30,
    description: 'Lower monthly equivalent — billed every 6 months after a 30-day trial.',
    sortOrder: 3,
  },
  {
    slug: 'provider_annual',
    name: 'Yearly',
    intervalLabel: 'year',
    intervalMonths: 12,
    priceGhs: 429.99,
    equivalentMonthlyGhs: 35.83,
    trialDays: 30,
    description: 'Best value, billed yearly after a 30-day trial.',
    sortOrder: 4,
  },
];

export function getProviderPlan(slug: string): ProviderPlanDefinition | undefined {
  return PROVIDER_PLANS.find((plan) => plan.slug === slug);
}

export function isProviderPlanSlug(value: unknown): value is ProviderPlanSlug {
  return PROVIDER_PLANS.some((plan) => plan.slug === value);
}

export function addMonths(from: Date, months: number): Date {
  const next = new Date(from.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
