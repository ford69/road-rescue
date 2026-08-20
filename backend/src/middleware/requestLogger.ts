import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

const sensitiveQueryKeys = new Set([
  'accessToken',
  'password',
  'refreshToken',
  'resetToken',
  'token',
]);

function safeUrl(req: Request): string {
  const url = new URL(req.originalUrl, 'http://road-rescue.local');
  for (const key of sensitiveQueryKeys) {
    if (url.searchParams.has(key)) {
      url.searchParams.set(key, '[REDACTED]');
    }
  }
  return `${url.pathname}${url.search}`;
}

function requestMetadata(req: Request) {
  return {
    requestId: req.requestId,
    method: req.method,
    url: safeUrl(req),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    userRole: req.user?.role,
  };
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.requestId = req.get('x-request-id')?.trim() || randomUUID();
  res.setHeader('x-request-id', req.requestId);

  if (!req.originalUrl.startsWith('/api')) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  logger.info('API request received', {
    event: 'api.request',
    ...requestMetadata(req),
  });

  let logged = false;
  const logResponse = (connectionClosed = false): void => {
    if (logged) return;
    logged = true;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const metadata = {
      event: 'api.response',
      ...requestMetadata(req),
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      contentLength: res.getHeader('content-length'),
      connectionClosed,
    };

    if (connectionClosed && !res.writableFinished) {
      logger.warn('API connection closed before response completed', metadata);
    } else if (res.statusCode >= 500) {
      logger.error('API request failed', metadata);
    } else if (res.statusCode >= 400) {
      logger.warn('API request rejected', metadata);
    } else {
      logger.info('API request completed', metadata);
    }
  };

  res.once('finish', () => logResponse());
  res.once('close', () => logResponse(true));
  next();
}
