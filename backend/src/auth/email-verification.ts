import crypto from 'node:crypto';

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export function createEmailVerification(now = new Date()): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
  };
}

export function evaluateVerificationToken(input: {
  emailVerified: boolean;
  expiresAt?: Date | null;
  now?: Date;
}): 'already_verified' | 'expired' | 'valid' {
  if (input.emailVerified) return 'already_verified';
  const now = input.now ?? new Date();
  if (input.expiresAt && input.expiresAt.getTime() < now.getTime()) return 'expired';
  return 'valid';
}
