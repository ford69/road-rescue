import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import path from 'node:path';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import authRoutes from './routes/auth.routes.js';
import apiRoutes from './routes/index.js';
import { paymentController } from './controllers/payment.controller.js';
import { asyncHandler } from './utils/asyncHandler.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('etag');
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGINS,
      credentials: true,
    }),
  );
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.NODE_ENV === 'development' ? Math.max(env.RATE_LIMIT_MAX, 2_000) : env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.post(
    '/api/webhooks/paystack',
    express.raw({ type: 'application/json', limit: '256kb' }),
    asyncHandler(paymentController.webhook),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(hpp());
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/uploads', express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'Road Rescue Ghana API',
      data: { version: '1.0.0', currency: 'GHS' },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
