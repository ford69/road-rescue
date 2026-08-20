import { z } from 'zod';
import { ghanaPhoneMessage, isValidGhanaPhone, normalizeGhanaPhone } from '../utils/phone.js';
import {
  ghanaCardMessage,
  isValidGhanaCard,
  normalizeGhanaCard,
} from '../utils/ghanaCard.js';

export const ghanaPhoneSchema = z
  .string()
  .min(9)
  .refine(isValidGhanaPhone, { message: ghanaPhoneMessage })
  .transform((value) => normalizeGhanaPhone(value)!);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

export const registerCustomerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: ghanaPhoneSchema,
  password: passwordSchema,
});

export const registerMechanicSchema = registerCustomerSchema.extend({
  garageName: z.string().min(2).max(100),
  ghanaCardNumber: z
    .string()
    .refine(isValidGhanaCard, { message: ghanaCardMessage })
    .transform(normalizeGhanaCard),
  experience: z.coerce.number().min(0).max(50).default(0),
  city: z.string().min(2),
  address: z.string().min(3),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  specialties: z.preprocess(
    (value) => (typeof value === 'string' ? [value] : value),
    z
      .array(z.enum(['towing', 'flat-tire', 'battery', 'lockout', 'fuel', 'accident', 'other']))
      .min(1),
  ),
  truck: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const createAdminSchema = registerCustomerSchema;

export const createVehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  colour: z.string().min(1),
  registrationNumber: z.string().min(3),
  year: z.coerce.number().min(1980).max(new Date().getFullYear() + 1),
  engineType: z.string().default('petrol'),
  nickname: z.string().optional(),
});

export const createRequestSchema = z.object({
  vehicleId: z.string().min(1),
  serviceType: z.enum(['towing', 'flat-tire', 'battery', 'lockout', 'fuel', 'accident', 'other']),
  pickupAddress: z.string().min(3),
  pickupCity: z.string().min(2),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  description: z.string().optional(),
  destinationAddress: z.string().optional(),
  destinationCity: z.string().optional(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(['accepted', 'enroute', 'arrived', 'inprogress', 'completed', 'cancelled']),
});

export const updateAvailabilitySchema = z.object({
  availability: z.boolean(),
});

export const verifyMechanicSchema = z.object({
  status: z.enum(['verified', 'rejected']),
});

export const sendChatMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export const updateLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  heading: z.coerce.number().min(0).max(360).optional(),
  speed: z.coerce.number().min(0).optional(),
  requestId: z.string().optional(),
});
