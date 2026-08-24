import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { env } from '../config/env.js';
import { parseMongoUri } from '../utils/mongoUri.js';
import { Mechanic, User } from '../models/index.js';

async function main(): Promise<void> {
  const { host, database } = parseMongoUri(env.MONGODB_URI);
  console.log(`environment=${env.NODE_ENV}`);
  console.log(`mongodb_host=${host}`);
  console.log(`mongodb_database=${database}`);

  await connectDatabase();
  const connectedDb = parseMongoUri(env.MONGODB_URI).database;
  console.log(`connected_database=${connectedDb}`);

  const [users, mechanics, mechanicsWithCard] = await Promise.all([
    User.countDocuments(),
    Mechanic.countDocuments(),
    Mechanic.countDocuments({ ghanaCardNumber: { $exists: true, $ne: null } }),
  ]);

  console.log(`users_total=${users}`);
  console.log(`mechanics_total=${mechanics}`);
  console.log(`mechanics_with_ghana_card=${mechanicsWithCard}`);

  await disconnectDatabase();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => undefined);
  });
