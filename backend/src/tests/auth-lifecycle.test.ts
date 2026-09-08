import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { optionalAuth, authenticate } from '../middleware/auth.js';
import { signAccessToken } from '../auth/tokens.js';
import { UnauthorizedError } from '../utils/errors.js';
import { createApp } from '../app.js';
import { expandClientOrigins, parseClientOrigins } from '../config/cors.js';
import { allowedSelfieTypes } from '../uploads/storage.js';
import { registerMechanicSchema } from '../validators/auth.validators.js';
import { shouldAttemptRefresh } from '../../../src/api/client/auth-session.ts';
import { statusFallbackMessage, userFacingAuthError } from '../../../src/api/client/parse-response.ts';

describe('optionalAuth (logout)', () => {
  const res = {} as Response;

  it('never 401s when the access token is missing', () => {
    const next = vi.fn() as NextFunction;
    optionalAuth({ headers: {}, cookies: {} } as Request, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('never 401s when the access token is expired or invalid', () => {
    const next = vi.fn() as NextFunction;
    optionalAuth(
      { headers: { authorization: 'Bearer not-a-token' }, cookies: {} } as Request,
      res,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('attaches the user when the access token is valid', () => {
    const token = signAccessToken({ sub: 'u1', role: 'customer', email: 'a@b.c' });
    const next = vi.fn() as NextFunction;
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} } as Request;
    optionalAuth(req, res, next);
    expect(req.user?.id).toBe('u1');
    expect(next).toHaveBeenCalledWith();
  });
});

describe('authenticate still protects private routes', () => {
  it('returns Authentication required when no token is present', () => {
    const next = vi.fn() as NextFunction;
    authenticate({ headers: {}, cookies: {} } as Request, {} as Response, next);
    const error = vi.mocked(next).mock.calls[0][0] as UnauthorizedError;
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toBe('Authentication required');
  });
});

describe('POST /api/auth/logout is idempotent', () => {
  it('returns 200 with an invalid bearer token', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer definitely-not-valid');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('returns 200 with leftover cookies that are not valid JWTs', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'accessToken=stale; refreshToken=stale');
    expect(response.status).toBe(200);
  });
});

describe('GET /api/auth/me still requires authentication', () => {
  it('returns 401 without a token', async () => {
    const app = createApp();
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });
});

describe('CORS origins', () => {
  it('adds the www counterpart of the production frontend', () => {
    expect(expandClientOrigins(['https://roadrescue4u.com'])).toEqual(
      expect.arrayContaining(['https://roadrescue4u.com', 'https://www.roadrescue4u.com']),
    );
  });

  it('does not expand localhost into a www host', () => {
    expect(parseClientOrigins('http://localhost:5173')).toEqual(['http://localhost:5173']);
  });

  it('strips trailing slashes from CLIENT_ORIGIN', () => {
    expect(parseClientOrigins('https://roadrescue4u.com/')).toContain('https://roadrescue4u.com');
  });
});

describe('mechanic selfie MIME types', () => {
  it('accepts image/jpg from some iOS cameras', () => {
    expect(allowedSelfieTypes.has('image/jpg')).toBe(true);
    expect(allowedSelfieTypes.has('image/jpeg')).toBe(true);
  });
});

describe('mechanic specialties payload', () => {
  it('parses a JSON array string from FormData', () => {
    const result = registerMechanicSchema.pick({ specialties: true }).safeParse({
      specialties: JSON.stringify(['towing', 'battery']),
    });
    expect(result.success).toBe(true);
  });
});

describe('client refresh race after logout', () => {
  it('does not refresh when generation changed (logout started)', () => {
    expect(
      shouldAttemptRefresh({
        status: 401,
        retry: true,
        path: '/auth/me',
        requestGeneration: 4,
        currentGeneration: 5,
        hasRefreshToken: true,
      }),
    ).toBe(false);
  });
});

describe('non-JSON API errors', () => {
  it('explains 413 uploads instead of a generic parse failure', () => {
    expect(statusFallbackMessage(413)).toMatch(/too large/i);
  });

  it('maps failed-to-fetch to a connection message', () => {
    expect(userFacingAuthError(new TypeError('Failed to fetch'), 'Unable to register')).toMatch(
      /Could not reach/,
    );
  });
});
