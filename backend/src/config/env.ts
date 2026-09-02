import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { parseClientOrigins } from './cors.js';

loadEnv();

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().optional());

const optionalTemplateId = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}, z.number().int().positive().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  UPLOAD_DIR: z.string().default('uploads'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@roadrescue.gh'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin123!'),
  SEED_ADMIN_PHONE: z.string().default('+233241000001'),
  PAYSTACK_SECRET_KEY: z.string().default(''),
  PAYSTACK_CALLBACK_URL: z.string().url().optional(),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(15),
  SUBSCRIPTION_BASIC_PRICE_GHS: z.coerce.number().min(0).default(49),
  SUBSCRIPTION_PREMIUM_PRICE_GHS: z.coerce.number().min(0).default(99),

  // Brevo transactional email
  BREVO_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  BREVO_API_URL: z.string().url().default('https://api.brevo.com/v3'),
  BREVO_SENDER_EMAIL: z.string().email().default('noreply@roadrescue4u.com'),
  BREVO_SENDER_NAME: z.string().min(1).default('Road Rescue Ghana'),
  BREVO_REPLY_TO_EMAIL: optionalEmail,
  SUPPORT_EMAIL: optionalEmail,
  // Optional Brevo dashboard template IDs (leave empty to use built-in HTML)
  BREVO_TEMPLATE_VERIFY_EMAIL: optionalTemplateId,
  BREVO_TEMPLATE_RESET_PASSWORD: optionalTemplateId,
  BREVO_TEMPLATE_WELCOME: optionalTemplateId,
  BREVO_TEMPLATE_MECHANIC_PENDING: optionalTemplateId,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

const clientOrigins = parseClientOrigins(parsed.data.CLIENT_ORIGIN);

export const env = {
  ...parsed.data,
  CLIENT_ORIGINS: clientOrigins,
  PRIMARY_CLIENT_ORIGIN: clientOrigins[0],
};
