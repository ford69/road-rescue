import { customerRepository } from '../repositories/customer.repository.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import {
  liveLocationRepository,
  notificationRepository,
  paymentRepository,
  serviceTypeRepository,
  assignmentRepository,
} from '../repositories/misc.repository.js';
import { requestRepository } from '../repositories/request.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { vehicleRepository } from '../repositories/vehicle.repository.js';
import type { RequestStatus } from '../types/index.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { assertObjectId, refId } from '../utils/objectId.js';
import type {
  createRequestSchema,
  createVehicleSchema,
  updateAvailabilitySchema,
  updateLocationSchema,
  updateRequestStatusSchema,
} from '../validators/auth.validators.js';
import type { z } from 'zod';
import { emitToRequest } from '../sockets/index.js';
import { paymentService } from './payment.service.js';
import { entitlementService } from './entitlement.service.js';

type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
type CreateRequestInput = z.infer<typeof createRequestSchema>;
type UpdateStatusInput = z.infer<typeof updateRequestStatusSchema>;
type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const vehicleService = {
  async listForUser(userId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    return vehicleRepository.findByCustomer(customer._id.toString());
  },

  async create(userId: string, input: CreateVehicleInput) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    return vehicleRepository.create({
      customerId: customer._id,
      make: input.make,
      vehicleModel: input.model,
      colour: input.colour,
      registrationNumber: input.registrationNumber.toUpperCase(),
      year: input.year,
      engineType: input.engineType,
      nickname: input.nickname,
    });
  },

  async remove(userId: string, vehicleId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle || vehicle.customerId.toString() !== customer._id.toString()) {
      throw new NotFoundError('Vehicle not found');
    }
    await vehicleRepository.deleteById(vehicleId);
    return { success: true };
  },
};

export const requestService = {
  async create(userId: string, input: CreateRequestInput) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');

    const activeRequest = await requestRepository.findActiveByCustomer(customer._id.toString());
    if (activeRequest) {
      throw new ValidationError('Complete or cancel your active rescue before creating another');
    }

    const vehicle = await vehicleRepository.findById(input.vehicleId);
    if (!vehicle || vehicle.customerId.toString() !== customer._id.toString()) {
      throw new NotFoundError('Vehicle not found');
    }

    const service = await serviceTypeRepository.findBySlug(input.serviceType);
    if (!service) throw new NotFoundError('Service type not found');
    await entitlementService.assertServiceAllowed(userId, input.serviceType);

    const entitlements = await entitlementService.getCustomerEntitlements(userId);
    const discountPercent = entitlementService.getMemberDiscountPercent(entitlements.planSlug);
    const quotedPrice = Math.round(service.estimatedPrice * (1 - discountPercent / 100) * 100) / 100;

    const request = await requestRepository.create({
      customer: customer._id,
      vehicle: vehicle._id,
      serviceType: input.serviceType,
      pickupLocation: {
        address: input.pickupAddress,
        city: input.pickupCity,
        latitude: input.latitude,
        longitude: input.longitude,
      },
      destination:
        input.destinationAddress && input.destinationCity
          ? {
              address: input.destinationAddress,
              city: input.destinationCity,
            }
          : undefined,
      description: input.description,
      images: [],
      status: 'requested',
      quotedPrice,
      paymentStatus: 'pending',
    });

    await paymentRepository.create({
      customer: customer._id,
      request: request._id,
      grossAmount: quotedPrice,
      amount: quotedPrice,
      platformFee: 0,
      providerAmount: quotedPrice,
      currency: 'GHS',
      paymentProvider: 'paystack',
      paymentMethod: 'mobile_money',
      status: 'pending',
      settlementStatus: 'pending',
    });

    await notificationRepository.create({
      title: 'Rescue requested',
      body: `We are matching a nearby mechanic for ${service.name} near ${input.pickupAddress}.`,
      recipient: customer.userId,
      type: 'info',
    });

    return requestRepository.findById(request._id.toString());
  },

  async listMine(userId: string, role: string) {
    if (role === 'customer') {
      const customer = await customerRepository.findByUserId(userId);
      if (!customer) throw new NotFoundError('Customer profile not found');
      return requestRepository.findByCustomer(customer._id.toString());
    }
    if (role === 'mechanic') {
      const mechanic = await mechanicRepository.findByUserId(userId);
      if (!mechanic) throw new NotFoundError('Mechanic profile not found');
      return requestRepository.findByMechanic(mechanic._id.toString());
    }
    return requestRepository.findAll();
  },

  async getById(userId: string, role: string, id: string) {
    const request = await requestRepository.findById(assertObjectId(id, 'request id'));
    if (!request) throw new NotFoundError('Rescue request not found');
    await assertRequestAccess(userId, role, request);
    return request;
  },

  async getLocation(userId: string, role: string, id: string) {
    const request = await requestRepository.findById(assertObjectId(id, 'request id'));
    if (!request) throw new NotFoundError('Rescue request not found');
    await assertRequestAccess(userId, role, request);
    return liveLocationRepository.findByRequest(id);
  },

  async listAvailableJobs(userId: string) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Mechanic profile not found');
    if (mechanic.verificationStatus !== 'verified') {
      throw new ForbiddenError('Your mechanic application must be verified before viewing jobs');
    }
    return requestRepository.findOpenForMechanics();
  },

  async accept(userId: string, requestId: string) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Mechanic profile not found');
    if (mechanic.verificationStatus !== 'verified') {
      throw new ForbiddenError('Your mechanic application must be verified before accepting jobs');
    }
    if (!mechanic.availability) {
      throw new ValidationError('Go online before accepting jobs');
    }

    const request = await requestRepository.findById(assertObjectId(requestId, 'request id'));
    if (!request) throw new NotFoundError('Rescue request not found');
    if (request.status !== 'requested' || request.mechanic) {
      ConflictAccept();
    }

    await requestRepository.updateStatus(requestId, 'accepted', {
      mechanic: mechanic._id,
      acceptedAt: new Date(),
    });

    await assignmentRepository.create({
      request: request._id,
      mechanic: mechanic._id,
      customer: refId(request.customer),
      status: 'accepted',
      offeredAt: new Date(),
      respondedAt: new Date(),
    });

    const customer = await customerRepository.findById(refId(request.customer));
    if (customer) {
      await notificationRepository.create({
        title: 'Mechanic assigned',
        body: `${mechanic.garageName} accepted your rescue request and is preparing to depart.`,
        recipient: customer.userId,
        type: 'success',
      });
    }

    return requestRepository.findById(requestId);
  },

  async updateStatus(userId: string, role: string, requestId: string, input: UpdateStatusInput) {
    const request = await requestRepository.findById(assertObjectId(requestId, 'request id'));
    if (!request) throw new NotFoundError('Rescue request not found');

    if (role === 'mechanic') {
      const mechanic = await mechanicRepository.findByUserId(userId);
      if (!mechanic || !request.mechanic || refId(request.mechanic) !== mechanic._id.toString()) {
        throw new ForbiddenError('You are not assigned to this request');
      }
      assertMechanicTransition(request.status, input.status);
    }

    if (role === 'customer') {
      const customer = await customerRepository.findByUserId(userId);
      if (!customer || refId(request.customer) !== customer._id.toString()) {
        throw new ForbiddenError('You do not own this request');
      }
      if (input.status !== 'cancelled') {
        throw new ForbiddenError('Customers can only cancel requests');
      }
      if (!['requested', 'accepted'].includes(request.status)) {
        throw new ValidationError('This request can no longer be cancelled');
      }
    }

    const extras: Record<string, Date> = {};
    if (input.status === 'arrived') extras.arrivedAt = new Date();
    if (input.status === 'cancelled') extras.cancelledAt = new Date();

    await requestRepository.updateStatus(requestId, input.status as RequestStatus, extras);
    emitToRequest(requestId, 'request:status', {
      requestId,
      status: input.status,
      updatedAt: new Date().toISOString(),
    });

    const customer = await customerRepository.findById(refId(request.customer));
    if (customer) {
      const statusMessages: Partial<Record<string, { title: string; body: string; type: 'info' | 'success' | 'warning' }>> = {
        enroute: {
          title: 'Mechanic en route',
          body: 'Your mechanic is on the way to your location.',
          type: 'info',
        },
        arrived: {
          title: 'Mechanic arrived',
          body: 'Your mechanic has arrived at the pickup location.',
          type: 'success',
        },
        inprogress: {
          title: 'Service in progress',
          body: 'Your roadside assistance service has started.',
          type: 'info',
        },
        completed: {
          title: 'Service completed',
          body: 'The customer confirmed this service is complete.',
          type: 'success',
        },
        cancelled: {
          title: 'Request cancelled',
          body: 'Your rescue request was cancelled.',
          type: 'warning',
        },
      };
      const message = statusMessages[input.status];
      if (message) {
        await notificationRepository.create({
          title: message.title,
          body: message.body,
          recipient: customer.userId,
          type: message.type,
        });
      }
    }

    return requestRepository.findById(requestId);
  },

  async requestConfirmation(userId: string, requestId: string) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Mechanic profile not found');
    const request = await requestRepository.findById(assertObjectId(requestId, 'request id'));
    if (!request) throw new NotFoundError('Rescue request not found');
    if (!request.mechanic || refId(request.mechanic) !== mechanic._id.toString()) {
      throw new ForbiddenError('You are not assigned to this request');
    }
    if (request.status !== 'inprogress' && request.status !== 'issue_reported') {
      throw new ValidationError('You can request confirmation only after the service is in progress');
    }

    await requestRepository.updateStatus(requestId, 'awaiting_confirmation', {
      completionRequestedAt: new Date(),
      completionRequestedBy: mechanic.userId,
    });
    emitToRequest(requestId, 'request:status', {
      requestId,
      status: 'awaiting_confirmation',
      updatedAt: new Date().toISOString(),
    });

    const customer = await customerRepository.findById(refId(request.customer));
    if (customer) {
      await notificationRepository.create({
        title: 'Service completion requested',
        body: 'Your mechanic has requested confirmation that your service is complete. Please review and confirm.',
        recipient: customer.userId,
        type: 'info',
        meta: { requestId },
      });
    }

    return requestRepository.findById(requestId);
  },

  async confirmCompletion(userId: string, requestId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    const request = await requestRepository.findById(assertObjectId(requestId, 'request id'));
    if (!request) throw new NotFoundError('Rescue request not found');
    if (refId(request.customer) !== customer._id.toString()) {
      throw new ForbiddenError('You do not own this request');
    }
    if (request.status !== 'awaiting_confirmation') {
      throw new ValidationError('This service is not waiting for your confirmation');
    }

    await requestRepository.updateStatus(requestId, 'completed', {
      completedAt: new Date(),
      customerConfirmedAt: new Date(),
      customerConfirmedBy: customer.userId,
    });
    emitToRequest(requestId, 'request:status', {
      requestId,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    });

    if (request.mechanic) {
      const mechanic = await mechanicRepository.findById(refId(request.mechanic));
      if (mechanic) {
        mechanic.completedJobs += 1;
        await mechanic.save();
        await notificationRepository.create({
          title: 'Customer confirmed completion',
          body: 'The customer confirmed that the service is complete.',
          recipient: mechanic.userId,
          type: 'success',
          meta: { requestId },
        });
      }
    }

    await notificationRepository.create({
      title: 'Service completed',
      body: `Your rescue is complete. Amount due: ₵${request.quotedPrice}.`,
      recipient: customer.userId,
      type: 'success',
      meta: { requestId },
    });

    return requestRepository.findById(requestId);
  },

  async reportIssue(userId: string, requestId: string, reason: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    const request = await requestRepository.findById(assertObjectId(requestId, 'request id'));
    if (!request) throw new NotFoundError('Rescue request not found');
    if (refId(request.customer) !== customer._id.toString()) {
      throw new ForbiddenError('You do not own this request');
    }
    if (request.status !== 'awaiting_confirmation' && request.status !== 'inprogress') {
      throw new ValidationError('You can only report an issue on an active service');
    }

    await requestRepository.updateStatus(requestId, 'issue_reported', {
      issueReportedAt: new Date(),
      issueReportedBy: customer.userId,
      issueReason: reason,
    });
    emitToRequest(requestId, 'request:status', {
      requestId,
      status: 'issue_reported',
      updatedAt: new Date().toISOString(),
    });

    const { SupportTicket } = await import('../models/SupportTicket.js');
    await SupportTicket.create({
      user: customer.userId,
      subject: 'Service issue reported',
      description: `Request ${requestId}: ${reason}`,
      category: 'rescue',
      status: 'open',
    });

    if (request.mechanic) {
      const mechanic = await mechanicRepository.findById(refId(request.mechanic));
      if (mechanic) {
        await notificationRepository.create({
          title: 'Customer reported an issue',
          body: 'The customer reported a problem with this service. Please follow up.',
          recipient: mechanic.userId,
          type: 'warning',
          meta: { requestId },
        });
      }
    }

    const admins = await userRepository.findByRole('admin');
    await Promise.all(
      admins.map((admin) =>
        notificationRepository.create({
          title: 'Service issue reported',
          body: 'A customer reported an issue that needs review.',
          recipient: admin._id,
          type: 'warning',
          meta: { requestId },
        }),
      ),
    );

    return requestRepository.findById(requestId);
  },
};

function ConflictAccept(): never {
  throw new ValidationError('This job is no longer available');
}

async function assertRequestAccess(
  userId: string,
  role: string,
  request: { customer: unknown; mechanic?: unknown },
): Promise<void> {
  if (role === 'admin') return;
  if (role === 'customer') {
    const customer = await customerRepository.findByUserId(userId);
    if (customer && refId(request.customer) === customer._id.toString()) return;
  }
  if (role === 'mechanic') {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (
      mechanic &&
      request.mechanic &&
      refId(request.mechanic) === mechanic._id.toString()
    ) {
      return;
    }
  }
  throw new ForbiddenError('You cannot access this rescue request');
}

const mechanicTransitions: Record<string, string[]> = {
  accepted: ['enroute', 'cancelled'],
  enroute: ['arrived', 'cancelled'],
  arrived: ['inprogress'],
};

function assertMechanicTransition(current: string, next: string): void {
  const allowed = mechanicTransitions[current] ?? [];
  if (!allowed.includes(next)) {
    throw new ValidationError(`Cannot move job from ${current} to ${next}`);
  }
}

export const mechanicService = {
  async setAvailability(userId: string, input: UpdateAvailabilityInput) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Mechanic profile not found');
    if (input.availability && mechanic.verificationStatus !== 'verified') {
      throw new ForbiddenError('Your mechanic application must be verified before going online');
    }
    mechanic.availability = input.availability;
    await mechanic.save();
    return mechanic;
  },

  async updateLocation(userId: string, input: UpdateLocationInput) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Mechanic profile not found');
    if (input.requestId) {
      const request = await requestRepository.findById(
        assertObjectId(input.requestId, 'request id'),
      );
      if (
        !request ||
        !request.mechanic ||
        refId(request.mechanic) !== mechanic._id.toString()
      ) {
        throw new ForbiddenError('You are not assigned to this request');
      }
      if (!['accepted', 'enroute', 'arrived', 'inprogress', 'awaiting_confirmation', 'issue_reported'].includes(request.status)) {
        throw new ValidationError('Location sharing is not active for this request');
      }
    }
    mechanic.latitude = input.latitude;
    mechanic.longitude = input.longitude;
    await mechanic.save();
    const location = await liveLocationRepository.upsertLatest({
      mechanic: mechanic._id.toString(),
      request: input.requestId,
      latitude: input.latitude,
      longitude: input.longitude,
      heading: input.heading,
      speed: input.speed,
    });
    if (input.requestId) {
      emitToRequest(input.requestId, 'location:updated', {
        requestId: input.requestId,
        mechanicId: mechanic._id.toString(),
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading,
        speed: location.speed,
        recordedAt: location.recordedAt,
      });
    }
    return location;
  },

  async listNearby(lat: number, lng: number) {
    return mechanicRepository.findNearby(lat, lng);
  },

  async getPublicProfile(mechanicId: string) {
    const mechanic = await mechanicRepository
      .findById(assertObjectId(mechanicId, 'mechanic id'))
      .populate('userId', 'firstName lastName avatar');
    if (!mechanic) throw new NotFoundError('Mechanic not found');
    const user = mechanic.userId as unknown as {
      firstName?: string;
      lastName?: string;
      avatar?: string;
    };
    return {
      id: mechanic._id.toString(),
      name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || mechanic.garageName,
      garageName: mechanic.garageName,
      avatar: user?.avatar ?? null,
      verificationStatus: mechanic.verificationStatus,
      experience: mechanic.experience,
      specialties: mechanic.specialties,
      city: mechanic.location?.city ?? '',
      availability: mechanic.availability,
      rating: mechanic.rating,
      reviewCount: mechanic.reviewCount,
      completedJobs: mechanic.completedJobs,
    };
  },

  async listPublicReviews(mechanicId: string) {
    const mechanic = await mechanicRepository.findById(assertObjectId(mechanicId, 'mechanic id'));
    if (!mechanic) throw new NotFoundError('Mechanic not found');
    const { ratingRepository } = await import('../repositories/rating.repository.js');
    const ratings = await ratingRepository.findByMechanic(mechanic._id.toString());
    return ratings.map((rating) => {
      const customer = rating.customer as unknown as {
        userId?: { firstName?: string; lastName?: string };
      };
      const firstName = customer?.userId?.firstName ?? 'Customer';
      return {
        id: rating._id.toString(),
        stars: rating.stars,
        review: rating.review ?? '',
        customerName: firstName,
        createdAt: rating.createdAt,
      };
    });
  },

  async earnings(userId: string) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Mechanic profile not found');
    const [completed, payments] = await Promise.all([
      requestRepository.findByMechanic(mechanic._id.toString(), ['completed']),
      paymentRepository.findByMechanic(mechanic._id.toString()),
    ]);

    const paidPayments = payments.filter((payment) => payment.status === 'paid');
    const totalEarnings = paidPayments.reduce(
      (sum, payment) => sum + (payment.providerAmount ?? payment.amount),
      0,
    );
    const pendingPayments = paidPayments
      .filter((payment) => payment.settlementStatus !== 'settled')
      .reduce((sum, payment) => sum + (payment.providerAmount ?? payment.amount), 0);
    const settledPayments = paidPayments
      .filter((payment) => payment.settlementStatus === 'settled')
      .reduce((sum, payment) => sum + (payment.providerAmount ?? payment.amount), 0);

    return {
      totalEarnings,
      pendingPayments,
      settledPayments,
      completedJobs: mechanic.completedJobs,
      rating: mechanic.rating,
      jobs: completed,
      recentPayments: paidPayments.slice(0, 20).map((payment) => paymentService.serializePayment(payment)),
      payoutInfo: await paymentService.getMechanicPayoutInfo(userId),
      disclaimer:
        'Your payments are processed through our payment provider. Road Rescue does not hold your funds. Settlement timing depends on Paystack and your configured payout method.',
    };
  },
};

export const notificationService = {
  list(userId: string) {
    return notificationRepository.findByRecipient(userId);
  },
  markAllRead(userId: string) {
    return notificationRepository.markAllRead(userId);
  },
  markRead(userId: string, id: string) {
    return notificationRepository.markRead(id, userId);
  },
};

export const adminService = {
  async verifyMechanic(mechanicId: string, status: 'verified' | 'rejected') {
    const mechanic = await mechanicRepository.findById(assertObjectId(mechanicId, 'mechanic id'));
    if (!mechanic) throw new NotFoundError('Mechanic not found');

    mechanic.verificationStatus = status;
    if (status === 'rejected') mechanic.availability = false;
    await mechanic.save();

    const user = await userRepository.findById(mechanic.userId.toString());
    if (user) {
      user.status = status === 'verified' ? 'active' : 'inactive';
      await user.save();
      await notificationRepository.create({
        title: status === 'verified' ? 'Mechanic application approved' : 'Mechanic application rejected',
        body:
          status === 'verified'
            ? 'Your account is verified. You can now go online and accept rescue jobs.'
            : 'Your mechanic application was not approved. Contact support for assistance.',
        recipient: user._id,
        type: status === 'verified' ? 'success' : 'warning',
      });
    }

    return mechanic;
  },

  async dashboard() {
    const [customers, mechanics, requests, payments] = await Promise.all([
      userRepository.countByRole('customer'),
      userRepository.countByRole('mechanic'),
      requestRepository.findAll(),
      paymentRepository.findAll(),
    ]);

    const live = requests.filter((r) =>
      ['requested', 'accepted', 'enroute', 'arrived', 'inprogress'].includes(r.status),
    );
    const revenue = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      kpis: {
        customers,
        mechanics,
        liveJobs: live.length,
        revenueGhs: revenue,
      },
      liveJobs: live.slice(0, 20),
      mechanics: await mechanicRepository.findAll(),
      customers: await customerRepository.findAll(),
      payments,
      serviceTypes: await serviceTypeRepository.findAll(),
    };
  },
};

export const catalogService = {
  serviceTypes() {
    return serviceTypeRepository.findAll();
  },
};
