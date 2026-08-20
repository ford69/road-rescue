import winston from 'winston';
import { env } from './env.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;
const warningsOnly = winston.format((info) => (info.level === 'warn' ? info : false));

const consoleFormat = printf((info) => {
  const {
    level,
    message,
    timestamp: logTimestamp,
    stack,
    ...metadata
  } = info;
  const details = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
  return `${String(logTimestamp)} [${level}]: ${String(stack ?? message)}${details}`;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'road-rescue-api', environment: env.NODE_ENV },
  transports: [
    new winston.transports.Console({
      format: combine(
        errors({ stack: true }),
        timestamp(),
        ...(env.NODE_ENV === 'production' ? [] : [colorize({ level: true })]),
        consoleFormat,
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(errors({ stack: true }), timestamp(), json()),
    }),
    new winston.transports.File({
      filename: 'logs/warning.log',
      level: 'warn',
      format: combine(warningsOnly(), errors({ stack: true }), timestamp(), json()),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      level: 'info',
      format: combine(errors({ stack: true }), timestamp(), json()),
    }),
  ],
});
