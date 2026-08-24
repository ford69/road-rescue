import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { parseMongoUri } from '../utils/mongoUri.js';

export async function connectDatabase(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  const connection = await mongoose.connect(env.MONGODB_URI);
  const { host, database } = parseMongoUri(env.MONGODB_URI);
  logger.info('MongoDB connected', {
    environment: env.NODE_ENV,
    mongodb_host: host,
    mongodb_database: database,
  });
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
