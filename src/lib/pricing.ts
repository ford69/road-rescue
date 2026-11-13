import { formatGhs } from './currency';
import type {
  AdditionalChargeDto,
  PricingModel,
  PricingSnapshotDto,
  ProviderPriceRangeDto,
  ProviderServiceOfferingDto,
} from '@/api/types';

export function pricingModelLabel(model: PricingModel): string {
  if (model === 'starting_from') return 'Starting from';
  if (model === 'quote') return 'Quote required';
  return 'Fixed price';
}

export function formatPricingLabel(model: PricingModel, amountGhs: number | null | undefined): string {
  if (model === 'quote' || amountGhs == null) return 'Request a quote';
  if (model === 'starting_from') return `From ${formatGhs(amountGhs, 2)}`;
  return formatGhs(amountGhs, 2);
}

export function chargesTotal(charges: AdditionalChargeDto[] | undefined): number {
  return (charges ?? []).reduce((sum, charge) => sum + (charge.amountGhs || 0), 0);
}

export function snapshotCustomerTotal(snapshot?: PricingSnapshotDto | null): string {
  if (!snapshot) return '';
  if (snapshot.pricingModel === 'quote') return 'Request a quote';
  if (snapshot.pricingModel === 'starting_from') {
    return `From ${formatGhs(snapshot.displayedTotalGhs, 2)}`;
  }
  return formatGhs(snapshot.displayedTotalGhs, 2);
}

export function listedServiceAmountGhs(offering: ProviderServiceOfferingDto): number | null {
  if (offering.pricingModel === 'quote' || offering.basePriceGhs == null) return null;
  const extras = chargesTotal(
    (offering.additionalCharges ?? []).filter(
      (charge) => !(charge.kind === 'distance' && charge.perKmGhs),
    ),
  );
  return offering.basePriceGhs + extras;
}

export function formatProviderPriceRange(
  range?: ProviderPriceRangeDto | null,
  offerings: ProviderServiceOfferingDto[] = [],
): string {
  const priced =
    range?.pricedCount != null
      ? range
      : (() => {
          const amounts = offerings
            .map(listedServiceAmountGhs)
            .filter((amount): amount is number => amount != null);
          return {
            minGhs: amounts.length ? Math.min(...amounts) : null,
            maxGhs: amounts.length ? Math.max(...amounts) : null,
            hasStartingFrom: offerings.some((item) => item.pricingModel === 'starting_from'),
            quoteCount: offerings.filter((item) => item.pricingModel === 'quote').length,
            pricedCount: amounts.length,
          };
        })();
  if (priced.pricedCount === 0) {
    return priced.quoteCount > 0 ? 'Request a quote' : 'Prices not listed';
  }
  if (priced.minGhs == null || priced.maxGhs == null) return 'Prices not listed';
  const prefix = priced.hasStartingFrom ? 'From ' : '';
  if (Math.abs(priced.minGhs - priced.maxGhs) < 0.009) {
    return `${prefix}${formatGhs(priced.minGhs, 2)}`;
  }
  return `${prefix}${formatGhs(priced.minGhs, 2)} – ${formatGhs(priced.maxGhs, 2)}`;
}

export function formatChargeLine(charge: AdditionalChargeDto): string {
  if (charge.kind === 'distance' && charge.perKmGhs) {
    return `${charge.label}: ${formatGhs(charge.perKmGhs, 2)}/km`;
  }
  return `${charge.label}: ${formatGhs(charge.amountGhs, 2)}`;
}
