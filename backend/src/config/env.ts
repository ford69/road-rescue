import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { parseClientOrigins } from './cors.js';

loadEnv();

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
