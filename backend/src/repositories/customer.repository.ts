import { Customer, type ICustomer } from '../models/Customer.js';

export const customerRepository = {
  create(data: Partial<ICustomer>) {
    return Customer.create(data);
  },

  findByUserId(userId: string) {
    return Customer.findOne({ userId });
  },

  findById(id: string) {
    return Customer.findById(id);
  },

  findAll() {
    return Customer.find().populate('userId', 'firstName lastName email phone status').sort({
      createdAt: -1,
    });
  },
};
