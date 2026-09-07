import mongoose from 'mongoose';
import { Rating, type IRating } from '../models/Rating.js';

export const ratingRepository = {
  findByMechanic(mechanicId: string, limit = 50) {
    return Rating.find({ mechanic: mechanicId })
      .populate({
        path: 'customer',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .sort({ createdAt: -1 })
      .limit(limit);
  },

  async findByMechanicPaged(mechanicId: string, options: { skip: number; limit: number }) {
    const filter = { mechanic: mechanicId };
    const query = Rating.find(filter)
      .populate({
        path: 'customer',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .sort({ createdAt: -1 });
    const [items, total] = await Promise.all([
      query.skip(options.skip).limit(options.limit),
      Rating.countDocuments(filter),
    ]);
    return { items, total };
  },

  findByRequest(requestId: string) {
    return Rating.findOne({ request: requestId });
  },

  findByRequestIds(requestIds: string[]) {
    if (requestIds.length === 0) return Promise.resolve([] as IRating[]);
    return Rating.find({ request: { $in: requestIds } });
  },

  create(data: {
    customer: mongoose.Types.ObjectId | string;
    mechanic: mongoose.Types.ObjectId | string;
    request: mongoose.Types.ObjectId | string;
    stars: number;
    review?: string;
  }) {
    return Rating.create(data);
  },

  async aggregateForMechanic(mechanicId: string): Promise<{ average: number; count: number }> {
    const stats = await Rating.aggregate<{ average: number; count: number }>([
      { $match: { mechanic: new mongoose.Types.ObjectId(mechanicId) } },
      { $group: { _id: null, average: { $avg: '$stars' }, count: { $sum: 1 } } },
    ]);
    const row = stats[0];
    if (!row || row.count === 0) return { average: 0, count: 0 };
    return {
      average: Math.round(row.average * 10) / 10,
      count: row.count,
    };
  },
};
export type { IRating };
