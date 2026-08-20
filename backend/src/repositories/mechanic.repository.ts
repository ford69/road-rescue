import { Mechanic, type IMechanic } from '../models/Mechanic.js';

export const mechanicRepository = {
  create(data: Partial<IMechanic>) {
    return Mechanic.create(data);
  },

  findByUserId(userId: string) {
    return Mechanic.findOne({ userId });
  },

  findById(id: string) {
    return Mechanic.findById(id);
  },

  findByGhanaCardNumber(ghanaCardNumber: string) {
    return Mechanic.findOne({ ghanaCardNumber });
  },

  findAvailable() {
    return Mechanic.find({ availability: true, verificationStatus: 'verified' })
      .populate('userId', 'firstName lastName phone avatar')
      .sort({ rating: -1 });
  },

  findNearby(latitude: number, longitude: number, maxKm = 25) {
    // Approximate bounding-box filter; replace with GeoJSON 2dsphere in Phase 5.
    const latDelta = maxKm / 111;
    const lngDelta = maxKm / (111 * Math.cos((latitude * Math.PI) / 180));
    return Mechanic.find({
      availability: true,
      verificationStatus: 'verified',
      latitude: { $gte: latitude - latDelta, $lte: latitude + latDelta },
      longitude: { $gte: longitude - lngDelta, $lte: longitude + lngDelta },
    }).populate('userId', 'firstName lastName phone avatar');
  },

  findAll() {
    return Mechanic.find()
      .populate('userId', 'firstName lastName email phone status avatar')
      .sort({ createdAt: -1 });
  },
};
