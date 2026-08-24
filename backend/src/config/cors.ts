import type { CorsOptions } from 'cors';
import type { NextFunction, Request, Response } from 'express';

export function parseClientOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : ['http://localhost:5173'];
}

export function createCorsOptions(allowedOrigins: string[]): CorsOptions {
  return {
    origin(origin, callback) {
      // Non-browser clients (curl, health checks) may omit Origin.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
}

/**
 * Always attach CORS headers for allowed browser origins.
 * Mechanic registration uses multipart FormData and can skip preflight;
 * without these headers the browser blocks reading a successful 201.
 */
export function corsHeadersMiddleware(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.get('origin');
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Request-Id',
      );
      res.setHeader('Access-Control-Expose-Headers', 'x-request-id');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
