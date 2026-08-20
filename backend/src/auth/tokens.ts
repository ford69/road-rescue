import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AuthTokens, JwtPayload, Role } from '../types/index.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export function createTokenPair(userId: string, role: Role, email: string): AuthTokens {
  const payload: JwtPayload = { sub: userId, role, email };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, SALT_ROUNDS);
}

export async function compareToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

export function createRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
