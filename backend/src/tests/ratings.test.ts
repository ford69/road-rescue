import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, AuthErrorCode } from '../utils/errors.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { requestRepository } from '../repositories/request.repository.js';
import { ratingRepository } from '../repositories/rating.repository.js';
import { notificationRepository } from '../repositories/misc.repository.js';
import { requestService } from '../services/domain.service.js';
import { createRatingSchema } from '../validators/auth.validators.js';

vi.mock('../sockets/index.js', () => ({
  emitToRequest: vi.fn(),
}));

vi.mock('../repositories/mechanic.repository.js', () => ({
  mechanicRepository: {
    findByUserId: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../repositories/customer.repository.js', () => ({
  customerRepository: { findByUserId: vi.fn(), findById: vi.fn() },
}));

vi.mock('../repositories/request.repository.js', () => ({
  requestRepository: {
    findById: vi.fn(),
    findByMechanic: vi.fn(),
    findByMechanicPaged: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../repositories/rating.repository.js', () => ({
  ratingRepository: {
    findByRequest: vi.fn(),
    findByRequestIds: vi.fn(),
    create: vi.fn(),
    aggregateForMechanic: vi.fn(),
  },
}));

vi.mock('../repositories/misc.repository.js', () => ({
  notificationRepository: { create: vi.fn() },
  paymentRepository: {},
  liveLocationRepository: {},
  serviceTypeRepository: {},
  assignmentRepository: {},
}));

const mechanicUserId = '64a000000000000000000001';
const mechanicId = '64a000000000000000000002';
const otherMechanicUserId = '64a000000000000000000003';
const otherMechanicId = '64a000000000000000000099';
const customerUserId = '64a000000000000000000004';
const customerId = '64a000000000000000000005';
const otherCustomerUserId = '64a000000000000000000006';
const requestId = '64a000000000000000000007';

function mechanicDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => mechanicId },
    userId: mechanicUserId,
    rating: 0,
    reviewCount: 0,
    save: vi.fn(),
    ...overrides,
  };
}

function customerDoc(userId = customerUserId, id = customerId) {
  return {
    _id: { toString: () => id },
    userId,
  };
}

function requestDoc(status: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => requestId },
    status,
    mechanic: mechanicId,
    customer: customerId,
    ...overrides,
  };
}

describe('createRatingSchema', () => {
  it('accepts integer stars from 1 to 5', () => {
    expect(createRatingSchema.parse({ stars: 5 }).stars).toBe(5);
    expect(createRatingSchema.parse({ stars: '1' }).stars).toBe(1);
  });

  it('rejects invalid ratings', () => {
    expect(() => createRatingSchema.parse({ stars: 0 })).toThrow();
    expect(() => createRatingSchema.parse({ stars: 6 })).toThrow();
    expect(() => createRatingSchema.parse({ stars: -1 })).toThrow();
    expect(() => createRatingSchema.parse({ stars: 4.5 })).toThrow();
    expect(() => createRatingSchema.parse({ stars: 'excellent' })).toThrow();
  });
});

describe('provider ratings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationRepository.create).mockResolvedValue({} as never);
    vi.mocked(ratingRepository.findByRequest).mockResolvedValue(null);
    vi.mocked(ratingRepository.findByRequestIds).mockResolvedValue([]);
    vi.mocked(ratingRepository.aggregateForMechanic).mockResolvedValue({ average: 5, count: 1 });
    vi.mocked(ratingRepository.create).mockResolvedValue({
      _id: { toString: () => '64a000000000000000000008' },
      stars: 5,
      review: 'Excellent service.',
      createdAt: new Date('2026-09-06T12:00:00.000Z'),
    } as never);
  });

  it('creates a rating for a completed service owned by the customer', async () => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue(customerDoc() as never);
    vi.mocked(requestRepository.findById).mockResolvedValue(requestDoc('completed') as never);
    vi.mocked(mechanicRepository.findById).mockResolvedValue(mechanicDoc() as never);

    const result = await requestService.rateCompleted(customerUserId, requestId, {
      stars: 5,
      review: 'Excellent service.',
    });

    expect(ratingRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mechanic: mechanicId,
        stars: 5,
        review: 'Excellent service.',
      }),
    );
    expect(vi.mocked(ratingRepository.create).mock.calls[0][0].customer.toString()).toBe(customerId);
    expect(result).toMatchObject({
      rating: 5,
      review: 'Excellent service.',
      serviceId: requestId,
      providerId: mechanicId,
    });
    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Customer Review',
        recipient: mechanicUserId,
      }),
    );
  });

  it('rejects rating before the service is completed', async () => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue(customerDoc() as never);
    vi.mocked(requestRepository.findById).mockResolvedValue(requestDoc('inprogress') as never);

    await expect(
      requestService.rateCompleted(customerUserId, requestId, { stars: 5 }),
    ).rejects.toMatchObject({
      message: 'You can rate this provider after the service is completed.',
      code: AuthErrorCode.SERVICE_NOT_COMPLETED,
    });
    expect(ratingRepository.create).not.toHaveBeenCalled();
  });

  it('rejects rating another customer\'s completed service', async () => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue(
      customerDoc(otherCustomerUserId, '64a000000000000000000088') as never,
    );
    vi.mocked(requestRepository.findById).mockResolvedValue(requestDoc('completed') as never);

    await expect(
      requestService.rateCompleted(otherCustomerUserId, requestId, { stars: 4 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(ratingRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate rating for the same service', async () => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue(customerDoc() as never);
    vi.mocked(requestRepository.findById).mockResolvedValue(requestDoc('completed') as never);
    vi.mocked(ratingRepository.findByRequest).mockResolvedValue({ _id: 'existing' } as never);

    await expect(
      requestService.rateCompleted(customerUserId, requestId, { stars: 5 }),
    ).rejects.toMatchObject({
      message: 'You have already rated this service.',
      code: AuthErrorCode.ALREADY_RATED,
    });
    expect(ratingRepository.create).not.toHaveBeenCalled();
  });

  it('updates provider aggregation from stored ratings', async () => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue(customerDoc() as never);
    vi.mocked(requestRepository.findById).mockResolvedValue(requestDoc('completed') as never);
    const mechanic = mechanicDoc();
    vi.mocked(mechanicRepository.findById).mockResolvedValue(mechanic as never);
    vi.mocked(ratingRepository.aggregateForMechanic).mockResolvedValue({
      average: 4.7,
      count: 3,
    });

    await requestService.rateCompleted(customerUserId, requestId, { stars: 5 });

    expect(ratingRepository.aggregateForMechanic).toHaveBeenCalledWith(mechanicId);
    expect(mechanic.rating).toBe(4.7);
    expect(mechanic.reviewCount).toBe(3);
    expect(mechanic.save).toHaveBeenCalled();
  });
});

describe('mechanic job history', () => {
  const paging = { page: 1, limit: 20, skip: 0, q: '' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ratingRepository.findByRequestIds).mockResolvedValue([]);
  });

  it('returns only completed jobs for the authenticated mechanic', async () => {
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue(mechanicDoc() as never);
    vi.mocked(requestRepository.findByMechanicPaged).mockResolvedValue({
      items: [
        requestDoc('completed', {
          serviceType: 'flat-tire',
          pickupLocation: { address: 'Osu', city: 'Accra' },
          customer: { _id: customerId, userId: { firstName: 'Clifford', lastName: 'Manu', phone: 'secret' } },
        }),
      ],
      total: 1,
    } as never);

    const result = await requestService.listMechanicCompletedHistory(mechanicUserId, paging);

    expect(requestRepository.findByMechanicPaged).toHaveBeenCalledWith(mechanicId, {
      statuses: ['completed'],
      skip: 0,
      limit: 20,
      q: '',
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect((result.items[0] as { customer?: { userId?: { phone?: string } } }).customer?.userId).not.toHaveProperty(
      'phone',
    );
  });

  it('pages completed jobs without using a client-supplied mechanic id', async () => {
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue(mechanicDoc() as never);
    vi.mocked(requestRepository.findByMechanicPaged).mockResolvedValue({ items: [], total: 45 } as never);

    const result = await requestService.listMechanicCompletedHistory(mechanicUserId, {
      page: 2,
      limit: 20,
      skip: 20,
      q: '',
    });

    expect(requestRepository.findByMechanicPaged).toHaveBeenCalledWith(mechanicId, {
      statuses: ['completed'],
      skip: 20,
      limit: 20,
      q: '',
    });
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);
    expect(result.hasMore).toBe(true);
  });

  it('does not return another mechanic\'s jobs when a different mechanic is authenticated', async () => {
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue(
      mechanicDoc({
        _id: { toString: () => otherMechanicId },
        userId: otherMechanicUserId,
      }) as never,
    );
    vi.mocked(requestRepository.findByMechanicPaged).mockResolvedValue({ items: [], total: 0 } as never);

    const result = await requestService.listMechanicCompletedHistory(otherMechanicUserId, paging);

    expect(requestRepository.findByMechanicPaged).toHaveBeenCalledWith(otherMechanicId, {
      statuses: ['completed'],
      skip: 0,
      limit: 20,
      q: '',
    });
    expect(requestRepository.findByMechanicPaged).not.toHaveBeenCalledWith(
      mechanicId,
      expect.anything(),
    );
    expect(result.items).toEqual([]);
  });
});

describe('rating aggregation rounding', () => {
  it('rounds 5, 4 and 5 to one decimal place', () => {
    const average = (5 + 4 + 5) / 3;
    expect(Math.round(average * 10) / 10).toBe(4.7);
  });
});
