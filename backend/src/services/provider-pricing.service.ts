import { env } from '../config/env.js';
import type { IMechanic } from '../models/Mechanic.js';
import type {
  IAdditionalCharge,
  IProviderServicePricing,
} from '../models/ProviderServicePricing.js';
import type {
  IJobQuote,
  IPricingChargeSnapshot,
  IPricingSnapshot,
  IRescueRequest,
} from '../models/RescueRequest.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { serviceTypeRepository } from '../repositories/misc.repository.js';
import {
  pricingAuditRepository,
  providerPricingRepository,
} from '../repositories/provider-pricing.repository.js';
import type {
  AdditionalChargeKind,
  PricingConfirmationStatus,
  PricingModel,
  ServiceTypeSlug,
} from '../types/index.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { distanceKm } from '../utils/geo.js';
import { addGhs, multiplyGhs } from '../utils/money.js';
import { assertObjectId } from '../utils/objectId.js';
import { SERVICE_CATEGORIES, categoryIdForSlug } from './service-catalogue.js';

const CHARGE_LABELS: Record<AdditionalChargeKind, string> = {
  call_out: 'Call-out fee',
  distance: 'Distance fee',
  emergency: 'Emergency surcharge',
  inspection: 'Inspection fee',
  labour: 'Labour charge',
  other: 'Additional charge',
};

export function isPriceConfirmed(status?: PricingConfirmationStatus | null): boolean {
  return status === 'confirmed' || status === 'accepted';
}

export function publicPriceLabel(pricing: {
  pricingModel: PricingModel;
  basePriceGhs: number;
}): { label: string; amountGhs: number | null } {
  if (pricing.pricingModel === 'quote') {
    return { label: 'Request a quote', amountGhs: null };
  }
  if (pricing.pricingModel === 'starting_from') {
    return { label: `From ₵${pricing.basePriceGhs.toFixed(2)}`, amountGhs: pricing.basePriceGhs };
  }
  return { label: `₵${pricing.basePriceGhs.toFixed(2)}`, amountGhs: pricing.basePriceGhs };
}

export function listedServiceAmountGhs(offering: {
  pricingModel: PricingModel;
  basePriceGhs: number | null;
  additionalCharges?: Array<{ kind: string; amountGhs?: number; perKmGhs?: number }>;
}): number | null {
  if (offering.pricingModel === 'quote' || offering.basePriceGhs == null) return null;
  const extras = addGhs(
    (offering.additionalCharges ?? [])
      .filter((charge) => !(charge.kind === 'distance' && charge.perKmGhs))
      .map((charge) => charge.amountGhs ?? 0),
  );
  return addGhs([offering.basePriceGhs, extras]);
}

export function publicPriceRange(
  offerings: Array<{
    pricingModel: PricingModel;
    basePriceGhs: number | null;
    additionalCharges?: Array<{ kind: string; amountGhs?: number; perKmGhs?: number }>;
  }>,
) {
  const priced = offerings
    .map(listedServiceAmountGhs)
    .filter((amount): amount is number => amount != null);
  const quoteCount = offerings.filter((item) => item.pricingModel === 'quote').length;
  const hasStartingFrom = offerings.some((item) => item.pricingModel === 'starting_from');
  const minGhs = priced.length ? Math.min(...priced) : null;
  const maxGhs = priced.length ? Math.max(...priced) : null;
  return {
    minGhs,
    maxGhs,
    hasStartingFrom,
    quoteCount,
    pricedCount: priced.length,
  };
}

function isCommissionableCharge(charge: IAdditionalCharge): boolean {
  if (charge.commissionable === false) return false;
  if (charge.commissionable === true) return true;
  return charge.kind !== 'other';
}

function toChargeDto(charge: IAdditionalCharge): IPricingChargeSnapshot {
  return {
    kind: charge.kind,
    label: charge.label || CHARGE_LABELS[charge.kind],
    amountGhs: charge.amountGhs ?? 0,
    perKmGhs: charge.perKmGhs,
    commissionable: isCommissionableCharge(charge),
  };
}

function resolveCharges(
  charges: IAdditionalCharge[],
  km?: number,
): IPricingChargeSnapshot[] {
  return charges.map((charge) => {
    const base = toChargeDto(charge);
    if (charge.kind === 'distance' && charge.perKmGhs && km && km > 0) {
      return { ...base, amountGhs: multiplyGhs(charge.perKmGhs, km) };
    }
    return base;
  });
}

export function commissionableFromCharges(
  model: PricingModel,
  basePriceGhs: number,
  charges: IPricingChargeSnapshot[],
  acceptedAmountGhs?: number,
): number {
  const extras = addGhs(
    charges.filter((charge) => charge.commissionable).map((charge) => charge.amountGhs),
  );
  if (model === 'quote' && acceptedAmountGhs === undefined) return 0;
  const base =
    acceptedAmountGhs !== undefined
      ? acceptedAmountGhs
      : model === 'fixed' || model === 'starting_from'
        ? basePriceGhs
        : 0;
  return addGhs([base, extras]);
}

export function buildSnapshot(input: {
  serviceType: ServiceTypeSlug;
  serviceName: string;
  pricing: IProviderServicePricing;
  pickup: { latitude: number; longitude: number };
  provider: { latitude: number; longitude: number };
}): IPricingSnapshot {
  const km = distanceKm(
    input.provider.latitude,
    input.provider.longitude,
    input.pickup.latitude,
    input.pickup.longitude,
  );
  const additionalCharges = resolveCharges(input.pricing.additionalCharges ?? [], km);
  const displayedTotalGhs =
    input.pricing.pricingModel === 'quote'
      ? addGhs(additionalCharges.map((charge) => charge.amountGhs))
      : commissionableFromCharges(
          input.pricing.pricingModel,
          input.pricing.basePriceGhs,
          additionalCharges,
        );
  const commissionableAmountGhs =
    input.pricing.pricingModel === 'fixed'
      ? displayedTotalGhs
      : 0;

  return {
    serviceType: input.serviceType,
    serviceName: input.serviceName,
    pricingModel: input.pricing.pricingModel,
    basePriceGhs: input.pricing.pricingModel === 'quote' ? 0 : input.pricing.basePriceGhs,
    additionalCharges,
    distanceKm: Math.round(km * 10) / 10,
    currency: 'GHS',
    displayedTotalGhs,
    commissionableAmountGhs,
    partsNotIncluded: Boolean(input.pricing.partsNotIncluded),
    snapshotAt: new Date(),
  };
}

function offeringDto(pricing: IProviderServicePricing) {
  const display = publicPriceLabel(pricing);
  return {
    id: pricing._id.toString(),
    serviceType: pricing.serviceType,
    pricingModel: pricing.pricingModel,
    basePriceGhs: pricing.pricingModel === 'quote' ? null : pricing.basePriceGhs,
    currency: 'GHS' as const,
    additionalCharges: (pricing.additionalCharges ?? []).map(toChargeDto),
    partsNotIncluded: Boolean(pricing.partsNotIncluded),
    active: pricing.active,
    displayLabel: display.label,
    updatedAt: pricing.updatedAt,
  };
}

async function syncSpecialties(mechanic: IMechanic) {
  const offerings = await providerPricingRepository.findByMechanic(mechanic._id.toString());
  const specialties = offerings
    .filter((item) => item.active)
    .map((item) => item.serviceType);
  await mechanicRepository.updateSpecialties(mechanic._id.toString(), specialties);
}

export const providerPricingService = {
  rules() {
    return {
      currency: 'GHS' as const,
      minPriceGhs: env.PROVIDER_PRICE_MIN_GHS,
      maxPriceGhs: env.PROVIDER_PRICE_MAX_GHS,
      maxChargeGhs: env.PROVIDER_CHARGE_MAX_GHS,
      chargeKinds: Object.entries(CHARGE_LABELS).map(([id, label]) => ({ id, label })),
    };
  },

  async listForProvider(userId: string) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Provider profile not found');
    const [catalogue, offerings] = await Promise.all([
      serviceTypeRepository.findAll(),
      providerPricingRepository.findByMechanic(mechanic._id.toString()),
    ]);
    const bySlug = new Map(offerings.map((item) => [item.serviceType, item]));
    const categories = SERVICE_CATEGORIES.map((category) => ({
      id: category.id,
      name: category.name,
      services: catalogue
        .filter((service) => category.slugs.includes(service.slug))
        .map((service) => ({
          slug: service.slug,
          name: service.name,
          description: service.description,
          categoryId: category.id,
          offering: bySlug.get(service.slug) ? offeringDto(bySlug.get(service.slug)!) : null,
        })),
    })).filter((category) => category.services.length > 0);

    return {
      ...this.rules(),
      categories,
      offerings: offerings.map(offeringDto),
    };
  },

  async upsert(userId: string, input: {
    serviceType: ServiceTypeSlug;
    pricingModel: PricingModel;
    basePriceGhs?: number;
    additionalCharges?: IAdditionalCharge[];
    partsNotIncluded?: boolean;
    active?: boolean;
  }) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Provider profile not found');
    const service = await serviceTypeRepository.findBySlug(input.serviceType);
    if (!service || !service.active) {
      throw new ValidationError('That service is not in the Road Rescue catalogue');
    }

    const saved = await providerPricingRepository.upsert(mechanic._id.toString(), {
      serviceType: input.serviceType,
      pricingModel: input.pricingModel,
      basePriceGhs: input.pricingModel === 'quote' ? 0 : input.basePriceGhs ?? 0,
      additionalCharges: input.additionalCharges ?? [],
      partsNotIncluded: Boolean(input.partsNotIncluded),
      active: input.active ?? true,
    });
    await syncSpecialties(mechanic);
    await pricingAuditRepository.create({
      actorUser: userId,
      mechanic: mechanic._id.toString(),
      action: 'provider_pricing_upsert',
      serviceType: input.serviceType,
      metadata: { pricingModel: input.pricingModel, basePriceGhs: saved.basePriceGhs },
    });
    return offeringDto(saved);
  },

  async setStatus(userId: string, serviceType: ServiceTypeSlug, active: boolean) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Provider profile not found');
    const updated = await providerPricingRepository.setActive(
      mechanic._id.toString(),
      serviceType,
      active,
    );
    if (!updated) throw new NotFoundError('Service pricing not found');
    await syncSpecialties(mechanic);
    await pricingAuditRepository.create({
      actorUser: userId,
      mechanic: mechanic._id.toString(),
      action: active ? 'provider_service_enabled' : 'provider_service_disabled',
      serviceType,
    });
    return offeringDto(updated);
  },

  async remove(userId: string, serviceType: ServiceTypeSlug) {
    return this.setStatus(userId, serviceType, false);
  },

  async listProvidersForService(
    serviceType: ServiceTypeSlug,
    lat: number,
    lng: number,
  ) {
    const service = await serviceTypeRepository.findBySlug(serviceType);
    if (!service || !service.active) throw new NotFoundError('Service type not found');
    const nearby = await mechanicRepository.findNearby(lat, lng);
    if (nearby.length === 0) return [];
    const nearbyIds = nearby.map((item) => item._id.toString());
    const offerings = await providerPricingRepository.findActiveByMechanics(nearbyIds, serviceType);
    const offeringByMechanic = new Map(
      offerings.map((item) => [item.mechanic.toString(), item]),
    );

    return nearby
      .filter((mechanic) => offeringByMechanic.has(mechanic._id.toString()))
      .map((mechanic) => {
        const offering = offeringByMechanic.get(mechanic._id.toString())!;
        const user = mechanic.userId as unknown as {
          firstName?: string;
          lastName?: string;
          phone?: string;
          avatar?: string;
        };
        const km = distanceKm(lat, lng, mechanic.latitude, mechanic.longitude);
        const snapshot = buildSnapshot({
          serviceType,
          serviceName: service.name,
          pricing: offering,
          pickup: { latitude: lat, longitude: lng },
          provider: { latitude: mechanic.latitude, longitude: mechanic.longitude },
        });
        const display = publicPriceLabel(offering);
        return {
          mechanicId: mechanic._id.toString(),
          garageName: mechanic.garageName,
          name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || mechanic.garageName,
          rating: mechanic.rating ?? 0,
          reviewCount: mechanic.reviewCount ?? 0,
          completedJobs: mechanic.completedJobs ?? 0,
          availability: Boolean(mechanic.availability),
          experience: mechanic.experience ?? 0,
          city: mechanic.location?.city ?? '',
          latitude: mechanic.latitude,
          longitude: mechanic.longitude,
          distanceKm: Math.round(km * 10) / 10,
          avatar: user?.avatar ?? null,
          serviceType,
          serviceName: service.name,
          pricingModel: offering.pricingModel,
          basePriceGhs: offering.pricingModel === 'quote' ? null : offering.basePriceGhs,
          displayLabel: display.label,
          additionalCharges: snapshot.additionalCharges,
          displayedTotalGhs: snapshot.displayedTotalGhs,
          partsNotIncluded: snapshot.partsNotIncluded,
          currency: 'GHS' as const,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  },

  async listPublicForMechanic(mechanicId: string) {
    const mechanic = await mechanicRepository.findById(
      assertObjectId(mechanicId, 'mechanic id'),
    );
    if (!mechanic) throw new NotFoundError('Provider not found');
    const [catalogue, offerings] = await Promise.all([
      serviceTypeRepository.findAll(),
      providerPricingRepository.findByMechanic(mechanic._id.toString()),
    ]);
    const bySlug = new Map(catalogue.map((item) => [item.slug, item]));
    return offerings
      .filter((item) => item.active)
      .map((item) => {
        const service = bySlug.get(item.serviceType);
        const categoryId = categoryIdForSlug(item.serviceType);
        return {
          ...offeringDto(item),
          serviceName: service?.name ?? item.serviceType,
          serviceDescription: service?.description ?? '',
          categoryId,
          categoryName: SERVICE_CATEGORIES.find((category) => category.id === categoryId)?.name,
        };
      });
  },

  async snapshotForMechanic(
    mechanicId: string,
    serviceType: ServiceTypeSlug,
    pickup: { latitude: number; longitude: number },
  ): Promise<{ mechanic: IMechanic; snapshot: IPricingSnapshot }> {
    const mechanic = await mechanicRepository.findById(
      assertObjectId(mechanicId, 'mechanic id'),
    );
    if (!mechanic) throw new NotFoundError('Provider not found');
    if (mechanic.verificationStatus !== 'verified') {
      throw new ValidationError('That provider is not verified yet');
    }
    const [pricing, service] = await Promise.all([
      providerPricingRepository.findActiveByMechanicAndService(mechanicId, serviceType),
      serviceTypeRepository.findBySlug(serviceType),
    ]);
    if (!pricing) {
      throw new ValidationError('That provider does not currently offer this service');
    }
    if (!service?.active) throw new ValidationError('That service is not available');
    return {
      mechanic,
      snapshot: buildSnapshot({
        serviceType,
        serviceName: service.name,
        pricing,
        pickup,
        provider: { latitude: mechanic.latitude, longitude: mechanic.longitude },
      }),
    };
  },

  confirmationStatusFor(snapshot: IPricingSnapshot): PricingConfirmationStatus {
    if (snapshot.pricingModel === 'fixed') return 'confirmed';
    return 'pending_quote';
  },

  quotedPriceFor(snapshot: IPricingSnapshot): number {
    return snapshot.pricingModel === 'fixed' ? snapshot.commissionableAmountGhs : 0;
  },

  async assertOffersService(mechanicId: string, serviceType: ServiceTypeSlug) {
    const pricing = await providerPricingRepository.findActiveByMechanicAndService(
      mechanicId,
      serviceType,
    );
    if (!pricing) {
      throw new ForbiddenError('You do not offer this service');
    }
    return pricing;
  },

  async adminListCatalogue() {
    const types = await serviceTypeRepository.findAllAdmin();
    return types.map((type) => ({
      _id: type._id,
      slug: type.slug,
      name: type.name,
      description: type.description,
      icon: type.icon,
      active: type.active,
      categoryId: categoryIdForSlug(type.slug),
    }));
  },

  async adminSetCatalogueStatus(
    actorUserId: string,
    slug: ServiceTypeSlug,
    active: boolean,
    reason?: string,
  ) {
    const updated = await serviceTypeRepository.setActive(slug, active);
    if (!updated) throw new NotFoundError('Service type not found');
    await pricingAuditRepository.create({
      actorUser: actorUserId,
      action: active ? 'catalogue_activate' : 'catalogue_deactivate',
      serviceType: slug,
      reason,
    });
    return {
      _id: updated._id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      icon: updated.icon,
      active: updated.active,
    };
  },

  async adminListProviderServices(mechanicId: string) {
    const mechanic = await mechanicRepository.findById(
      assertObjectId(mechanicId, 'mechanic id'),
    );
    if (!mechanic) throw new NotFoundError('Provider not found');
    const offerings = await providerPricingRepository.findByMechanic(mechanic._id.toString());
    return {
      mechanicId: mechanic._id.toString(),
      garageName: mechanic.garageName,
      offerings: offerings.map(offeringDto),
    };
  },
};

export function applyAcceptedQuote(
  request: IRescueRequest,
  quote: IJobQuote,
): void {
  if (!request.pricingSnapshot) return;
  const extras = addGhs(
    request.pricingSnapshot.additionalCharges
      .filter((charge) => charge.commissionable)
      .map((charge) => charge.amountGhs),
  );
  request.quotedPrice = addGhs([quote.commissionableAmountGhs, extras]);
  request.pricingSnapshot.commissionableAmountGhs = request.quotedPrice;
  request.pricingConfirmationStatus = 'accepted';
  request.pendingQuote = undefined;
}

export function assertCanRequestCompletion(request: IRescueRequest): void {
  if (!request.pricingSnapshot) return;
  if (!isPriceConfirmed(request.pricingConfirmationStatus)) {
    throw new ValidationError(
      request.pricingSnapshot.pricingModel === 'quote'
        ? 'The customer must accept your quote before you can request completion'
        : 'The customer must accept the final price before you can request completion',
    );
  }
}

export function assertCanCaptureCommission(request: IRescueRequest): void {
  if (!request.pricingSnapshot) return;
  if (!isPriceConfirmed(request.pricingConfirmationStatus) || request.quotedPrice <= 0) {
    throw new ValidationError('Commission can only be taken after the customer accepts the price');
  }
}

export function buildQuote(input: {
  amountGhs: number;
  partsGhs?: number;
  reason?: string;
  createdBy: string;
  revision?: boolean;
}): IJobQuote {
  return {
    amountGhs: input.amountGhs,
    commissionableAmountGhs: input.amountGhs,
    partsGhs: input.partsGhs ?? 0,
    reason: input.reason,
    createdAt: new Date(),
    createdBy: input.createdBy as unknown as IJobQuote['createdBy'],
    status: 'pending',
  };
}

export function assertCanSubmitQuote(request: IRescueRequest, reason?: string): void {
  if (!request.pricingSnapshot) {
    throw new ValidationError('This job does not use provider pricing quotes');
  }
  if (isPriceConfirmed(request.pricingConfirmationStatus) && !reason) {
    throw new ValidationError('Price changes after customer approval need a reason');
  }
}
