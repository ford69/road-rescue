import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase } from './database/connection.js';
import { initSockets } from './sockets/index.js';

async function bootstrap(): Promise<void> {
  if (
    env.NODE_ENV === 'production' &&
    env.CLIENT_ORIGINS.some((origin) => origin.includes('localhost'))
  ) {
    logger.warn('CLIENT_ORIGIN still includes localhost in production — browser CORS will fail', {
      clientOrigins: env.CLIENT_ORIGINS,
    });
  }

  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Road Rescue Ghana API listening on port ${env.PORT}`, {
      clientOrigins: env.CLIENT_ORIGINS,
      cookieSecure: env.COOKIE_SECURE,
      brevoConfigured: Boolean(env.BREVO_API_KEY),
      brevoSender: env.BREVO_SENDER_EMAIL,
    });
  });
  initSockets(server);
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
