import { RescueRequest, type IRescueRequest } from '../models/RescueRequest.js';
import type { RequestStatus } from '../types/index.js';

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

  findActiveByCustomer(customerId: string) {
    return RescueRequest.findOne({
      customer: customerId,
      status: {
        $in: ['requested', 'searching', 'assigned', 'accepted', 'enroute', 'arrived', 'inprogress'],
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
