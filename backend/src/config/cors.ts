import type { CorsOptions } from 'cors';
import type { NextFunction, Request, Response } from 'express';

function stripTrailingSlash(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

/** Include www and apex counterparts so Safari/PWA hosts both work. */
export function expandClientOrigins(origins: string[]): string[] {
  const expanded = new Set<string>();
  for (const origin of origins) {
    const normalized = stripTrailingSlash(origin.trim());
    if (!normalized) continue;
    expanded.add(normalized);
    try {
      const url = new URL(normalized);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') continue;
      if (url.hostname.startsWith('www.')) {
        url.hostname = url.hostname.slice(4);
      } else {
        url.hostname = `www.${url.hostname}`;
      }
      expanded.add(url.origin);
    } catch {
      // Ignore invalid origin strings from env.
    }
  }
  return [...expanded];
}

export function parseClientOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const parsed = origins.length > 0 ? origins : ['http://localhost:5173'];
  return expandClientOrigins(parsed);
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
