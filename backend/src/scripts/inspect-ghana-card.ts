import crypto from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { env } from '../config/env.js';
import { parseMongoUri } from '../utils/mongoUri.js';
import { Mechanic, User } from '../models/index.js';
import { normalizeGhanaCard, isValidGhanaCard } from '../utils/ghanaCard.js';

function cardHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function main(): Promise<void> {
  const rawCard = process.argv[2];
  if (!rawCard) {
    console.error('Usage: npm run inspect:ghana-card -- GHA-123456789-0');
    process.exitCode = 1;
    return;
  }

  if (!isValidGhanaCard(rawCard)) {
    console.error('Invalid Ghana Card format. Expected GHA-123456789-0');
    process.exitCode = 1;
    return;
  }

  const normalized = normalizeGhanaCard(rawCard);
  const { host, database } = parseMongoUri(env.MONGODB_URI);

  console.log(`environment=${env.NODE_ENV}`);
  console.log(`mongodb_host=${host}`);
  console.log(`mongodb_database=${database}`);
  console.log(`card_hash=${cardHash(normalized)}`);

  await connectDatabase();

  const mechanic = await Mechanic.findOne({ ghanaCardNumber: normalized });
  console.log(`duplicate_mechanic_found=${Boolean(mechanic)}`);

  if (!mechanic) {
    await disconnectDatabase();
    return;
  }

  console.log(`mechanic_id=${mechanic._id.toString()}`);
  console.log(`linked_user_id=${mechanic.userId.toString()}`);

  const user = await User.findById(mechanic.userId);
  console.log(`linked_user_exists=${Boolean(user)}`);

  if (user) {
    console.log(`linked_user_status=${user.status}`);
    console.log(`linked_user_role=${user.role}`);
    const domain = user.email.split('@')[1] ?? 'unknown';
    console.log(`linked_user_email_domain=${domain}`);
  } else {
    console.log('orphan_mechanic=true');
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
