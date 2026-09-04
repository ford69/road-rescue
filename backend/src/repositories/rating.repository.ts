import { Rating, type IRating } from '../models/Rating.js';

export const ratingRepository = {
  findByMechanic(mechanicId: string, limit = 20) {
    return Rating.find({ mechanic: mechanicId })
      .populate({
        path: 'customer',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .sort({ createdAt: -1 })
      .limit(limit);
  },
};
export type { IRating };
