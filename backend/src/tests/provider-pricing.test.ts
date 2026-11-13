import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, ValidationError } from '../utils/errors.js';
import {
  applyAcceptedQuote,
  assertCanCaptureCommission,
  assertCanRequestCompletion,
  buildQuote,
  buildSnapshot,
  commissionableFromCharges,
  isPriceConfirmed,
  providerPricingService,
  publicPriceLabel,
  publicPriceRange,
} from '../services/provider-pricing.service.js';
import { providerPricingRepository } from '../repositories/provider-pricing.repository.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { serviceTypeRepository } from '../repositories/misc.repository.js';
import { addGhs } from '../utils/money.js';
import { distanceKm } from '../utils/geo.js';

vi.mock('../repositories/provider-pricing.repository.js', () => ({
  providerPricingRepository: {
    findByMechanic: vi.fn(),
    findByMechanicAndService: vi.fn(),
    findActiveByMechanicAndService: vi.fn(),
    findActiveByMechanics: vi.fn(),
    upsert: vi.fn(),
    setActive: vi.fn(),
  },
  pricingAuditRepository: { create: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../repositories/mechanic.repository.js', () => ({
  mechanicRepository: {
    findByUserId: vi.fn(),
    findById: vi.fn(),
    findNearby: vi.fn(),
    updateSpecialties: vi.fn(),
  },
}));

vi.mock('../repositories/misc.repository.js', () => ({
  serviceTypeRepository: {
    findAll: vi.fn(),
    findBySlug: vi.fn(),
  },
}));

const userId = '64a000000000000000000001';
const mechanicId = '64a000000000000000000002';
const otherUserId = '64a000000000000000000003';

function mechanicDoc(id = mechanicId) {
  return {
    _id: { toString: () => id },
    garageName: 'Kwame Rescue',
    verificationStatus: 'verified',
    availability: true,
    rating: 4.8,
    reviewCount: 12,
    completedJobs: 40,
    experience: 6,
    latitude: 5.6037,
    longitude: -0.187,
    location: { city: 'Accra', address: 'Osu' },
    specialties: ['flat-tire'],
    userId: { firstName: 'Kwame', lastName: 'Mensah' },
  };
}

function catalogue() {
  return [
    {
      slug: 'flat-tire',
      name: 'Flat Tyre',
      description: 'Tyre change',
      active: true,
    },
  ];
}

function pricingDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => '64a000000000000000000010' },
    mechanic: mechanicId,
    serviceType: 'flat-tire',
    pricingModel: 'fixed',
    basePriceGhs: 100,
    additionalCharges: [],
    partsNotIncluded: false,
    active: true,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('provider pricing helpers', () => {
  it('labels fixed, starting-from and quote prices without a zero quote', () => {
    expect(publicPriceLabel({ pricingModel: 'fixed', basePriceGhs: 100 }).label).toContain('100');
    expect(publicPriceLabel({ pricingModel: 'starting_from', basePriceGhs: 150 }).label).toMatch(
      /^From /,
    );
    expect(publicPriceLabel({ pricingModel: 'quote', basePriceGhs: 0 }).label).toBe('Request a quote');
    expect(publicPriceLabel({ pricingModel: 'quote', basePriceGhs: 0 }).amountGhs).toBeNull();
  });

  it('summarises a provider price range without treating quotes as zero', () => {
    const range = publicPriceRange([
      { pricingModel: 'fixed', basePriceGhs: 100, additionalCharges: [] },
      { pricingModel: 'starting_from', basePriceGhs: 150, additionalCharges: [] },
      { pricingModel: 'quote', basePriceGhs: 0, additionalCharges: [] },
    ]);
    expect(range.minGhs).toBe(100);
    expect(range.maxGhs).toBe(150);
    expect(range.hasStartingFrom).toBe(true);
    expect(range.quoteCount).toBe(1);
    expect(range.pricedCount).toBe(2);
  });

  it('excludes parts-like other charges from the commission base', () => {
    const amount = commissionableFromCharges('fixed', 150, [
      { kind: 'call_out', label: 'Call-out', amountGhs: 20, commissionable: true },
      { kind: 'other', label: 'Parts', amountGhs: 80, commissionable: false },
    ]);
    expect(amount).toBe(170);
  });

  it('snapshots a fixed price and distance fee in GHS pesewas math', () => {
    const snapshot = buildSnapshot({
      serviceType: 'flat-tire',
      serviceName: 'Flat Tyre',
      pricing: pricingDoc({
        additionalCharges: [
          { kind: 'distance', label: 'Distance fee', amountGhs: 0, perKmGhs: 2, commissionable: true },
        ],
      }) as never,
      pickup: { latitude: 5.6037, longitude: -0.187 },
      provider: { latitude: 5.6137, longitude: -0.187 },
    });
    expect(snapshot.pricingModel).toBe('fixed');
    expect(snapshot.commissionableAmountGhs).toBeGreaterThanOrEqual(100);
    expect(snapshot.currency).toBe('GHS');
    expect(distanceKm(5.6037, -0.187, 5.6137, -0.187)).toBeGreaterThan(0);
    expect(addGhs([100, 20])).toBe(120);
  });

  it('does not treat an unconfirmed starting price as commissionable', () => {
    const snapshot = buildSnapshot({
      serviceType: 'other',
      serviceName: 'General Repairs',
      pricing: pricingDoc({
        serviceType: 'other',
        pricingModel: 'starting_from',
        basePriceGhs: 150,
      }) as never,
      pickup: { latitude: 5.6, longitude: -0.18 },
      provider: { latitude: 5.6, longitude: -0.18 },
    });
    expect(snapshot.commissionableAmountGhs).toBe(0);
    expect(snapshot.displayedTotalGhs).toBe(150);
    expect(isPriceConfirmed('pending_quote')).toBe(false);
  });
});

describe('provider pricing service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue(mechanicDoc() as never);
    vi.mocked(serviceTypeRepository.findAll).mockResolvedValue(catalogue() as never);
    vi.mocked(serviceTypeRepository.findBySlug).mockResolvedValue({
      slug: 'flat-tire',
      name: 'Flat Tyre',
      active: true,
    } as never);
    vi.mocked(providerPricingRepository.findByMechanic).mockResolvedValue([] as never);
    vi.mocked(mechanicRepository.updateSpecialties).mockResolvedValue({} as never);
  });

  it('lets a provider set a fixed price', async () => {
    vi.mocked(providerPricingRepository.upsert).mockResolvedValue(
      pricingDoc({ basePriceGhs: 100 }) as never,
    );
    const result = await providerPricingService.upsert(userId, {
      serviceType: 'flat-tire',
      pricingModel: 'fixed',
      basePriceGhs: 100,
    });
    expect(result.basePriceGhs).toBe(100);
    expect(result.pricingModel).toBe('fixed');
  });

  it('lets a provider set a starting-from price', async () => {
    vi.mocked(providerPricingRepository.upsert).mockResolvedValue(
      pricingDoc({ pricingModel: 'starting_from', basePriceGhs: 150 }) as never,
    );
    const result = await providerPricingService.upsert(userId, {
      serviceType: 'flat-tire',
      pricingModel: 'starting_from',
      basePriceGhs: 150,
    });
    expect(result.displayLabel).toMatch(/^From /);
  });

  it('lets a provider select quote-required pricing without a fake zero price', async () => {
    vi.mocked(providerPricingRepository.upsert).mockResolvedValue(
      pricingDoc({ pricingModel: 'quote', basePriceGhs: 0 }) as never,
    );
    const result = await providerPricingService.upsert(userId, {
      serviceType: 'flat-tire',
      pricingModel: 'quote',
    });
    expect(result.basePriceGhs).toBeNull();
    expect(result.displayLabel).toBe('Request a quote');
  });

  it('updates an existing price through upsert', async () => {
    vi.mocked(providerPricingRepository.upsert).mockResolvedValue(
      pricingDoc({ basePriceGhs: 120 }) as never,
    );
    const result = await providerPricingService.upsert(userId, {
      serviceType: 'flat-tire',
      pricingModel: 'fixed',
      basePriceGhs: 120,
    });
    expect(result.basePriceGhs).toBe(120);
  });

  it('disables a service without deleting the pricing record', async () => {
    vi.mocked(providerPricingRepository.setActive).mockResolvedValue(
      pricingDoc({ active: false }) as never,
    );
    const result = await providerPricingService.setStatus(userId, 'flat-tire', false);
    expect(result.active).toBe(false);
    expect(providerPricingRepository.setActive).toHaveBeenCalledWith(mechanicId, 'flat-tire', false);
  });

  it('rejects catalogue services that are not approved', async () => {
    vi.mocked(serviceTypeRepository.findBySlug).mockResolvedValue(null as never);
    await expect(
      providerPricingService.upsert(userId, {
        serviceType: 'flat-tire',
        pricingModel: 'fixed',
        basePriceGhs: 100,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('customer discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serviceTypeRepository.findBySlug).mockResolvedValue({
      slug: 'flat-tire',
      name: 'Flat Tyre',
      active: true,
    } as never);
  });

  it('returns provider-specific prices and hides disabled offerings', async () => {
    vi.mocked(mechanicRepository.findNearby).mockResolvedValue([
      mechanicDoc(),
      {
        ...mechanicDoc('64a000000000000000000099'),
        garageName: 'Ama Towing',
        userId: { firstName: 'Ama', lastName: 'Boateng' },
      },
    ] as never);
    vi.mocked(providerPricingRepository.findActiveByMechanics).mockResolvedValue([
      pricingDoc({ basePriceGhs: 100 }),
      pricingDoc({
        mechanic: '64a000000000000000000099',
        basePriceGhs: 120,
      }),
    ] as never);

    const rows = await providerPricingService.listProvidersForService('flat-tire', 5.6037, -0.187);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.basePriceGhs).sort()).toEqual([100, 120]);
  });

  it('excludes disabled services from discovery', async () => {
    vi.mocked(mechanicRepository.findNearby).mockResolvedValue([mechanicDoc()] as never);
    vi.mocked(providerPricingRepository.findActiveByMechanics).mockResolvedValue([] as never);
    const rows = await providerPricingService.listProvidersForService('flat-tire', 5.6037, -0.187);
    expect(rows).toHaveLength(0);
  });
});

describe('job quotes and commission eligibility', () => {
  it('preserves a fixed snapshot and treats it as confirmed', () => {
    const snapshot = buildSnapshot({
      serviceType: 'flat-tire',
      serviceName: 'Flat Tyre',
      pricing: pricingDoc() as never,
      pickup: { latitude: 5.6, longitude: -0.18 },
      provider: { latitude: 5.6, longitude: -0.18 },
    });
    expect(providerPricingService.quotedPriceFor(snapshot)).toBe(100);
    expect(providerPricingService.confirmationStatusFor(snapshot)).toBe('confirmed');
  });

  it('requires customer acceptance before completion and commission', () => {
    const request = {
      pricingSnapshot: { pricingModel: 'quote' },
      pricingConfirmationStatus: 'quoted',
      quotedPrice: 0,
    };
    expect(() => assertCanRequestCompletion(request as never)).toThrow(ValidationError);
    expect(() => assertCanCaptureCommission(request as never)).toThrow(ValidationError);
  });

  it('applies an accepted quote as the commissionable amount plus extras', () => {
    const request = {
      quotedPrice: 0,
      pricingConfirmationStatus: 'quoted',
      pricingSnapshot: {
        additionalCharges: [{ kind: 'call_out', amountGhs: 10, commissionable: true }],
        commissionableAmountGhs: 0,
      },
      pendingQuote: { status: 'pending' },
    };
    const quote = buildQuote({ amountGhs: 150, createdBy: userId });
    applyAcceptedQuote(request as never, quote);
    expect(request.quotedPrice).toBe(160);
    expect(request.pricingConfirmationStatus).toBe('accepted');
  });

  it('does not let another provider’s identity pass ownership checks in upsert', async () => {
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue(null as never);
    await expect(
      providerPricingService.upsert(otherUserId, {
        serviceType: 'flat-tire',
        pricingModel: 'fixed',
        basePriceGhs: 80,
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('ownership', () => {
  it('blocks a provider from asserting another provider’s service offering', async () => {
    vi.mocked(providerPricingRepository.findActiveByMechanicAndService).mockResolvedValue(
      null as never,
    );
    await expect(
      providerPricingService.assertOffersService(mechanicId, 'flat-tire'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
