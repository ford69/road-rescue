import { Subscription, type ISubscription } from '../models/Subscription.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';

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
};
