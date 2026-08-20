import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase } from './database/connection.js';
import { initSockets } from './sockets/index.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Road Rescue Ghana API listening on port ${env.PORT}`);
  });
  initSockets(server);
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
