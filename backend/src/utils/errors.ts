export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly code?: string;

  constructor(
    statusCode: number,
    message: string,
    details?: unknown,
    isOperational = true,
    code?: string,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details?: unknown, code?: string) {
    super(400, message, details, true, code);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code?: string) {
    super(401, message, undefined, true, code);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code?: string) {
    super(403, message, undefined, true, code);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', code?: string) {
    super(404, message, undefined, true, code);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict', code?: string) {
    super(409, message, undefined, true, code);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests', code = 'RATE_LIMITED') {
    super(429, message, undefined, true, code);
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(500, message, details, false);
  }
}

export const AuthErrorCode = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  VERIFICATION_TOKEN_INVALID: 'VERIFICATION_TOKEN_INVALID',
  VERIFICATION_TOKEN_EXPIRED: 'VERIFICATION_TOKEN_EXPIRED',
  EMAIL_ALREADY_VERIFIED: 'EMAIL_ALREADY_VERIFIED',
  VERIFICATION_EMAIL_RATE_LIMITED: 'VERIFICATION_EMAIL_RATE_LIMITED',
} as const;
