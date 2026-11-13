import { z } from 'zod';
import { env } from '../config/env.js';

const serviceTypeEnum = z.enum([
  'towing',
  'flat-tire',
  'battery',
  'lockout',
  'fuel',
  'accident',
  'other',
]);

const additionalChargeSchema = z
  .object({
    kind: z.enum(['call_out', 'distance', 'emergency', 'inspection', 'labour', 'other']),
    label: z.string().trim().min(2).max(80),
    amountGhs: z.coerce.number().min(0).max(env.PROVIDER_CHARGE_MAX_GHS).optional(),
    perKmGhs: z.coerce.number().min(0).max(env.PROVIDER_CHARGE_MAX_GHS).optional(),
    commissionable: z.boolean().optional(),
  })
  .superRefine((charge, ctx) => {
    if (charge.kind === 'distance') {
      if (!charge.perKmGhs || charge.perKmGhs <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['perKmGhs'],
          message: 'Distance fees need a per-kilometre amount greater than zero',
        });
      }
      return;
    }
    if (charge.amountGhs === undefined || charge.amountGhs <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['amountGhs'],
        message: 'Additional charges must be greater than zero',
      });
    }
  });

export const upsertProviderServiceSchema = z
  .object({
    serviceType: serviceTypeEnum,
    pricingModel: z.enum(['fixed', 'starting_from', 'quote']),
    basePriceGhs: z.coerce.number().min(0).max(env.PROVIDER_PRICE_MAX_GHS).optional(),
    additionalCharges: z.array(additionalChargeSchema).max(12).optional(),
    partsNotIncluded: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.pricingModel === 'quote') return;
    if (value.basePriceGhs === undefined || value.basePriceGhs < env.PROVIDER_PRICE_MIN_GHS) {
      ctx.addIssue({
        code: 'custom',
        path: ['basePriceGhs'],
        message: `Enter a price of at least ₵${env.PROVIDER_PRICE_MIN_GHS}`,
      });
    }
  });

export const providerServiceStatusSchema = z.object({
  active: z.boolean(),
});

export const submitJobQuoteSchema = z.object({
  amountGhs: z.coerce.number().min(env.PROVIDER_PRICE_MIN_GHS).max(env.PROVIDER_PRICE_MAX_GHS),
  partsGhs: z.coerce.number().min(0).max(env.PROVIDER_CHARGE_MAX_GHS).optional(),
  reason: z.string().trim().min(3).max(400).optional(),
});

export const rejectJobQuoteSchema = z.object({
  reason: z.string().trim().min(3).max(400).optional(),
});

export const adminServiceTypeStatusSchema = z.object({
  active: z.boolean(),
  reason: z.string().trim().min(3).max(400).optional(),
});
