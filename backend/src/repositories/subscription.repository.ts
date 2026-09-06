import { Subscription, type ISubscription } from '../models/Subscription.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';
import {
  SubscriptionCheckout,
  type ISubscriptionCheckout,
} from '../models/SubscriptionCheckout.js';
import { ProcessedPaystackEvent } from '../models/ProcessedPaystackEvent.js';

export const subscriptionPlanRepository = {
  findAll() {
    return SubscriptionPlan.find({ active: true }).sort({ sortOrder: 1 });
  },

  findBySlug(slug: string) {
    return SubscriptionPlan.findOne({ slug, active: true });
  },

  upsertPlan(data: {
    slug: 'free' | 'basic' | 'premium';
    name: string;
    description: string;
    monthlyPriceGhs: number;
    features: string[];
    sortOrder: number;
    paystackPlanCode?: string;
  }) {
    return SubscriptionPlan.findOneAndUpdate({ slug: data.slug }, data, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  },
};

export const subscriptionRepository = {
  create(data: Partial<ISubscription>) {
    return Subscription.create(data);
  },

  findByCustomer(customerId: string) {
    return Subscription.findOne({ customer: customerId });
  },

  upsertForCustomer(customerId: string, data: Partial<ISubscription>) {
    return Subscription.findOneAndUpdate({ customer: customerId }, data, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  },

  findByPaystackSubscriptionCode(code: string) {
    return Subscription.findOne({ paystackSubscriptionCode: code });
  },

  findByLastTransactionReference(reference: string) {
    return Subscription.findOne({ lastTransactionReference: reference });
  },
};

export const subscriptionCheckoutRepository = {
  create(data: Partial<ISubscriptionCheckout>) {
    return SubscriptionCheckout.create(data);
  },

  findByReference(reference: string) {
    return SubscriptionCheckout.findOne({ reference });
  },
};

export const processedPaystackEventRepository = {
  async claim(eventKey: string, event: string): Promise<boolean> {
    try {
      await ProcessedPaystackEvent.create({ eventKey, event });
      return true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        return false;
      }
      throw error;
    }
  },
};
