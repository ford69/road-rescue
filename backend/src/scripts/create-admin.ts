import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { hashPassword } from '../auth/tokens.js';
import { User } from '../models/User.js';
import { isValidGhanaPhone, normalizeGhanaPhone } from '../utils/phone.js';

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const email = getArg('email')?.trim().toLowerCase();
  const password = getArg('password');
  const firstName = getArg('first-name')?.trim() ?? 'Road Rescue';
  const lastName = getArg('last-name')?.trim() ?? 'Admin';
  const rawPhone = getArg('phone')?.trim();

  if (!email || !password || !rawPhone) {
    throw new Error(
      'Usage: npm run admin:create -- --email <email> --password <password> --phone <ghana-phone> [--first-name <name>] [--last-name <name>]',
    );
  }
  if (!isValidGhanaPhone(rawPhone)) {
    throw new Error('Phone must be a valid Ghana number, for example 0241234567');
  }
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    throw new Error('Password must be 8+ characters and include uppercase, lowercase, and a number');
  }

  const phone = normalizeGhanaPhone(rawPhone)!;
  await connectDatabase();

  const duplicate = await User.findOne({ $or: [{ email }, { phone }] });
  if (duplicate) {
    throw new Error('An account with this email or phone already exists');
  }

  await User.create({
    firstName,
    lastName,
    email,
    phone,
    password: await hashPassword(password),
    role: 'admin',
    status: 'active',
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });

  console.log(`Admin created: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => undefined);
  });
