import { Types } from 'mongoose';
import {
  ProviderServicePricing,
  type IProviderServicePricing,
} from '../models/ProviderServicePricing.js';
import { PricingAuditLog } from '../models/PricingAuditLog.js';
import type { ServiceTypeSlug } from '../types/index.js';

export const providerPricingRepository = {
  findByMechanic(mechanicId: string) {
    return ProviderServicePricing.find({ mechanic: mechanicId }).sort({ serviceType: 1 });
  },

  findByMechanicAndService(mechanicId: string, serviceType: ServiceTypeSlug) {
    return ProviderServicePricing.findOne({ mechanic: mechanicId, serviceType });
  },

  findActiveByMechanicAndService(mechanicId: string, serviceType: ServiceTypeSlug) {
    return ProviderServicePricing.findOne({
      mechanic: mechanicId,
      serviceType,
      active: true,
    });
  },

  findActiveByService(serviceType: ServiceTypeSlug) {
    return ProviderServicePricing.find({ serviceType, active: true });
  },

  findActiveByMechanics(mechanicIds: string[], serviceType?: ServiceTypeSlug) {
    const filter: Record<string, unknown> = {
      mechanic: { $in: mechanicIds.map((id) => new Types.ObjectId(id)) },
      active: true,
    };
    if (serviceType) filter.serviceType = serviceType;
    return ProviderServicePricing.find(filter);
  },

  upsert(mechanicId: string, data: Partial<IProviderServicePricing>) {
    return ProviderServicePricing.findOneAndUpdate(
      { mechanic: mechanicId, serviceType: data.serviceType },
      { $set: { ...data, mechanic: mechanicId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  },

  setActive(mechanicId: string, serviceType: ServiceTypeSlug, active: boolean) {
    return ProviderServicePricing.findOneAndUpdate(
      { mechanic: mechanicId, serviceType },
      { $set: { active } },
      { new: true },
    );
  },
};

export const pricingAuditRepository = {
  create(data: {
    actorUser: string;
    mechanic?: string;
    action: string;
    serviceType?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    return PricingAuditLog.create(data);
  },
};
