import { RescueRequest, type IRescueRequest } from '../models/RescueRequest.js';
import type { RequestStatus } from '../types/index.js';
import { escapeRegex } from '../utils/pagination.js';

export const requestRepository = {
  create(data: Partial<IRescueRequest>) {
    return RescueRequest.create(data);
  },

  findById(id: string) {
    return RescueRequest.findById(id)
      .populate('vehicle')
      .populate({
        path: 'mechanic',
        populate: { path: 'userId', select: 'firstName lastName phone avatar' },
      })
      .populate({
        path: 'customer',
        populate: { path: 'userId', select: 'firstName lastName phone' },
      });
  },

  findByCustomer(customerId: string) {
    return RescueRequest.find({ customer: customerId })
      .populate('vehicle')
      .populate({
        path: 'mechanic',
        populate: { path: 'userId', select: 'firstName lastName phone avatar' },
      })
      .sort({ createdAt: -1 });
  },

  async findByCustomerPaged(
    customerId: string,
    options: {
      statuses?: RequestStatus[];
      skip: number;
      limit: number;
      q?: string;
    },
  ) {
    const filter: Record<string, unknown> = { customer: customerId };
    if (options.statuses?.length) {
      filter.status = { $in: options.statuses };
    }
    if (options.q) {
      const pattern = new RegExp(escapeRegex(options.q), 'i');
      filter.$or = [
        { serviceType: pattern },
        { description: pattern },
        { 'pickupLocation.city': pattern },
        { 'pickupLocation.address': pattern },
      ];
    }
    const query = RescueRequest.find(filter)
      .populate('vehicle')
      .populate({
        path: 'mechanic',
        populate: { path: 'userId', select: 'firstName lastName phone avatar' },
      })
      .sort({ createdAt: -1 });
    const [items, total] = await Promise.all([
      query.skip(options.skip).limit(options.limit),
      RescueRequest.countDocuments(filter),
    ]);
    return { items, total };
  },

  countByCustomer(customerId: string, statuses?: RequestStatus[]) {
    const filter: Record<string, unknown> = { customer: customerId };
    if (statuses?.length) {
      filter.status = { $in: statuses };
    }
    return RescueRequest.countDocuments(filter);
  },

  findActiveByCustomer(customerId: string) {
    return RescueRequest.findOne({
      customer: customerId,
      status: {
        $in: [
          'requested',
          'searching',
          'assigned',
          'accepted',
          'enroute',
          'arrived',
          'inprogress',
          'awaiting_confirmation',
          'issue_reported',
        ],
      },
    }).sort({ createdAt: -1 });
  },

  findOpenForMechanics() {
    return RescueRequest.find({
      status: 'requested',
      $or: [{ mechanic: null }, { mechanic: { $exists: false } }],
    })
      .populate('vehicle')
      .populate({
        path: 'customer',
        populate: { path: 'userId', select: 'firstName lastName phone' },
      })
      .sort({ createdAt: -1 });
  },

  findByMechanic(mechanicId: string, statuses?: RequestStatus[]) {
    const filter: Record<string, unknown> = { mechanic: mechanicId };
    if (statuses?.length) {
      filter.status = { $in: statuses };
    }
    return RescueRequest.find(filter)
      .populate('vehicle')
      .populate({
        path: 'customer',
        populate: { path: 'userId', select: 'firstName lastName phone' },
      })
      .sort({ createdAt: -1 });
  },

  async findByMechanicPaged(
    mechanicId: string,
    options: {
      statuses?: RequestStatus[];
      skip: number;
      limit: number;
      q?: string;
    },
  ) {
    const filter: Record<string, unknown> = { mechanic: mechanicId };
    if (options.statuses?.length) {
      filter.status = { $in: options.statuses };
    }
    if (options.q) {
      const pattern = new RegExp(escapeRegex(options.q), 'i');
      filter.$or = [
        { serviceType: pattern },
        { description: pattern },
        { 'pickupLocation.city': pattern },
        { 'pickupLocation.address': pattern },
      ];
    }
    const query = RescueRequest.find(filter)
      .populate('vehicle')
      .populate({
        path: 'customer',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .sort({ completedAt: -1, createdAt: -1 });
    const [items, total] = await Promise.all([
      query.skip(options.skip).limit(options.limit),
      RescueRequest.countDocuments(filter),
    ]);
    return { items, total };
  },

  findAll() {
    return RescueRequest.find()
      .populate('vehicle')
      .populate({
        path: 'mechanic',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate({
        path: 'customer',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .sort({ createdAt: -1 })
      .limit(100);
  },

  updateStatus(id: string, status: RequestStatus, extra: Partial<IRescueRequest> = {}) {
    return RescueRequest.findByIdAndUpdate(id, { status, ...extra }, { new: true });
  },
};
