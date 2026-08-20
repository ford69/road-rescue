import { Vehicle, type IVehicle } from '../models/Vehicle.js';

export const vehicleRepository = {
  create(data: Partial<IVehicle>) {
    return Vehicle.create(data);
  },

  findByCustomer(customerId: string) {
    return Vehicle.find({ customerId }).sort({ createdAt: -1 });
  },

  findById(id: string) {
    return Vehicle.findById(id);
  },

  deleteById(id: string) {
    return Vehicle.findByIdAndDelete(id);
  },
};
