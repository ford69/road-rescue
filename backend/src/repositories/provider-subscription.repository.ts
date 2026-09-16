import {
  ProviderSubscription,
  type IProviderSubscription,
} from '../models/ProviderSubscription.js';
import {
  ProviderSubscriptionCheckout,
  type IProviderSubscriptionCheckout,
} from '../models/ProviderSubscriptionCheckout.js';

export const providerSubscriptionRepository = {
  create(data: Partial<IProviderSubscription>) {
    return ProviderSubscription.create(data);
  },

  findByUserId(userId: string) {
    return ProviderSubscription.findOne({ user: userId });
  },

  findByMechanicId(mechanicId: string) {
    return ProviderSubscription.findOne({ mechanic: mechanicId });
  },

  upsertForMechanic(mechanicId: string, data: Partial<IProviderSubscription>) {
    return ProviderSubscription.findOneAndUpdate({ mechanic: mechanicId }, data, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  },

  findByPaystackSubscriptionCode(code: string) {
    return ProviderSubscription.findOne({ paystackSubscriptionCode: code });
  },

  findByPaystackCustomerCode(code: string) {
    return ProviderSubscription.findOne({ paystackCustomerCode: code });
  },

  findByLastTransactionReference(reference: string) {
    return ProviderSubscription.findOne({ lastTransactionReference: reference });
  },
};

export const providerSubscriptionCheckoutRepository = {
  create(data: Partial<IProviderSubscriptionCheckout>) {
    return ProviderSubscriptionCheckout.create(data);
  },

  findByReference(reference: string) {
    return ProviderSubscriptionCheckout.findOne({ reference });
  },
};
