import type { CorsOptions } from 'cors';

export function parseClientOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : ['http://localhost:5173'];
}

export function createCorsOptions(origin: string[]): CorsOptions {
  return {
    origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
}
