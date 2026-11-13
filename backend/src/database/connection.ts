import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  expandMongoSrvUri,
  isMongoSrvTxtTimeout,
  parseMongoUri,
} from '../utils/mongoUri.js';

async function openConnection(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  const connection = await mongoose.connect(uri);
  const { host, database } = parseMongoUri(uri);
  logger.info('MongoDB connected', {
    environment: env.NODE_ENV,
    mongodb_host: host,
    mongodb_database: database,
  });
  return connection;
}

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    return await openConnection(env.MONGODB_URI);
  } catch (error) {
    if (!env.MONGODB_URI.startsWith('mongodb+srv://') || !isMongoSrvTxtTimeout(error)) {
      throw error;
    }

    const { host } = parseMongoUri(env.MONGODB_URI);
    logger.warn('MongoDB SRV TXT lookup timed out; retrying with SRV hosts', {
      mongodb_host: host,
    });
    const standardUri = await expandMongoSrvUri(env.MONGODB_URI);
    return openConnection(standardUri);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
