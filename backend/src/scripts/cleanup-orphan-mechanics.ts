import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { parseMongoUri } from '../utils/mongoUri.js';
import { env } from '../config/env.js';
import { Mechanic, User } from '../models/index.js';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const { host, database } = parseMongoUri(env.MONGODB_URI);

  console.log(`environment=${env.NODE_ENV}`);
  console.log(`mongodb_host=${host}`);
  console.log(`mongodb_database=${database}`);
  console.log(`mode=${apply ? 'apply' : 'dry-run'}`);

  await connectDatabase();

  const mechanics = await Mechanic.find({ ghanaCardNumber: { $exists: true, $ne: null } });
  const orphans: Array<{ mechanicId: string; ghanaCardPrefix: string }> = [];

  for (const mechanic of mechanics) {
    const user = await User.findById(mechanic.userId);
    if (user) continue;
    orphans.push({
      mechanicId: mechanic._id.toString(),
      ghanaCardPrefix: mechanic.ghanaCardNumber?.slice(0, 7) ?? 'unknown',
    });
    if (apply) {
      await Mechanic.deleteOne({ _id: mechanic._id });
    }
  }

  console.log(`orphan_mechanics_found=${orphans.length}`);

  for (const orphan of orphans) {
    console.log(`orphan_mechanic_id=${orphan.mechanicId} ghana_card_prefix=${orphan.ghanaCardPrefix}••••••`);
  }

  if (apply) {
    console.log(`orphan_mechanics_removed=${orphans.length}`);
  } else if (orphans.length > 0) {
    console.log('Re-run with --apply to remove orphan mechanic records.');
  }

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
