import { Notification, type INotification } from '../models/Notification.js';
import { ServiceType } from '../models/ServiceType.js';
import { Payment } from '../models/Payment.js';
import { Assignment } from '../models/Assignment.js';
import { LiveLocation } from '../models/LiveLocation.js';
import { ChatMessage, type IChatMessage } from '../models/ChatMessage.js';

export const notificationRepository = {
  create(data: Partial<INotification>) {
    return Notification.create(data);
  },

  findByRecipient(userId: string) {
    return Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(50);
  },

  markAllRead(userId: string) {
    return Notification.updateMany({ recipient: userId, read: false }, { read: true });
  },

  markRead(id: string, userId: string) {
    return Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { read: true },
      { new: true },
    );
  },
};

export const serviceTypeRepository = {
  findAll() {
    return ServiceType.find({ active: true }).sort({ name: 1 });
  },

  findAllAdmin() {
    return ServiceType.find().sort({ name: 1 });
  },

  findBySlug(slug: string) {
    return ServiceType.findOne({ slug });
  },

  setActive(slug: string, active: boolean) {
    return ServiceType.findOneAndUpdate({ slug }, { $set: { active } }, { new: true });
  },
};

export const paymentRepository = {
  create(data: Parameters<typeof Payment.create>[0]) {
    return Payment.create(data);
  },

  findByCustomer(customerId: string) {
    return Payment.find({ customer: customerId }).sort({ createdAt: -1 });
  },

  findById(id: string) {
    return Payment.findById(id);
  },

  findByRequest(requestId: string) {
    return Payment.findOne({ request: requestId });
  },

  findByReference(reference: string) {
    return Payment.findOne({ transactionReference: reference });
  },

  findByMechanic(mechanicId: string) {
    return Payment.find({ mechanic: mechanicId }).sort({ createdAt: -1 });
  },

  findAll() {
    return Payment.find().sort({ createdAt: -1 }).limit(100);
  },

  findAwaitingSettlement() {
    return Payment.find({
      status: 'paid',
      settlementStatus: { $in: ['pending', 'processing'] },
      settlementBatch: { $exists: false },
    }).sort({ paidAt: 1, createdAt: 1 });
  },

  claimForSettlement(id: string, batchId: string) {
    return Payment.findOneAndUpdate(
      {
        _id: id,
        status: 'paid',
        $or: [
          { settlementStatus: { $in: ['pending', 'processing'] }, settlementBatch: { $exists: false } },
          { settlementBatch: batchId },
        ],
      },
      {
        $set: {
          settlementStatus: 'settled',
          settlementBatch: batchId,
          settledAt: new Date(),
        },
      },
      { new: true },
    );
  },
};

export const assignmentRepository = {
  create(data: Parameters<typeof Assignment.create>[0]) {
    return Assignment.create(data);
  },

  findByRequest(requestId: string) {
    return Assignment.find({ request: requestId });
  },
};

export const liveLocationRepository = {
  upsertLatest(data: {
    mechanic: string;
    request?: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  }) {
    return LiveLocation.findOneAndUpdate(
      { mechanic: data.mechanic },
      { ...data, recordedAt: new Date() },
      { upsert: true, new: true },
    );
  },

  findByMechanic(mechanicId: string) {
    return LiveLocation.findOne({ mechanic: mechanicId }).sort({ recordedAt: -1 });
  },

  findByRequest(requestId: string) {
    return LiveLocation.findOne({ request: requestId }).sort({ recordedAt: -1 });
  },
};

export const chatMessageRepository = {
  create(data: Partial<IChatMessage>) {
    return ChatMessage.create(data).then((message) =>
      message.populate('sender', 'firstName lastName role avatar'),
    );
  },

  findByRequest(requestId: string) {
    return ChatMessage.find({ request: requestId })
      .populate('sender', 'firstName lastName role avatar')
      .sort({ createdAt: 1 })
      .limit(200);
  },
};
