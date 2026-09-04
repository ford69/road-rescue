import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/errors.js';
import multer from 'multer';

function isApiPath(req: Request): boolean {
  return req.path === '/api' || req.path.startsWith('/api/');
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  // Internet scanners hit random paths on public API hosts. Return 404 without
  // a stack trace so PM2 logs stay useful for real app traffic.
  if (!isApiPath(req)) {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      requestId: req.requestId,
    });
    return;
  }

  next(new ApiError(404, 'Route not found'));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Express requires 4 args to treat this as an error middleware.
  _next: NextFunction,
): void {
  void _next;
  const requestContext = {
    event: 'api.error',
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    userRole: req.user?.role,
    params: req.params,
    query: req.query,
  };

  if (
    err instanceof multer.MulterError ||
    (err instanceof Error && err.message.startsWith('Selfie must be'))
  ) {
    const message =
      err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'Selfie image must be 5MB or smaller'
        : err.message;
    logger.warn('Upload rejected', { ...requestContext, statusCode: 400, errorMessage: message });
    res.status(400).json({
      success: false,
      message,
      requestId: req.requestId,
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn('API validation failed', {
      ...requestContext,
      statusCode: 400,
      validationErrors: err.flatten(),
    });
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: err.flatten(),
      requestId: req.requestId,
    });
    return;
  }

  if (err instanceof ApiError) {
    const isClientError = err.isOperational && err.statusCode < 500;
    const errorMetadata = {
      ...requestContext,
      statusCode: err.statusCode,
      errorName: err.name,
      errorMessage: err.message,
      isOperational: err.isOperational,
      details: err.details,
      ...(isClientError ? {} : { stack: err.stack }),
    };

    if (!err.isOperational || err.statusCode >= 500) {
      logger.error('API operational error', errorMetadata);
    } else if (err.statusCode === 404) {
      logger.info('API route not found', errorMetadata);
    } else {
      logger.warn('API request error', errorMetadata);
    }

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      details: err.details,
      requestId: req.requestId,
    });
    return;
  }

  const unknownError =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { value: String(err) };
  logger.error('Unhandled API error', {
    ...requestContext,
    statusCode: 500,
    error: unknownError,
  });
  res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal server error' : String(err),
    requestId: req.requestId,
  });
}
