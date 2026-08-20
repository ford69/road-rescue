import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import {
  Assignment,
  ChatMessage,
  Customer,
  LiveLocation,
  Payment,
  RescueRequest,
} from '../models/index.js';

const demoDescriptions = [
  'Car will not start after shopping.',
  'Flat tyre after hitting a pothole.',
  'Ran out of fuel near East Legon.',
];

async function main(): Promise<void> {
  await connectDatabase();
  const requests = await RescueRequest.find({ description: { $in: demoDescriptions } }).select('_id');
  const requestIds = requests.map((request) => request._id);

  await Promise.all([
    Payment.deleteMany({ request: { $in: requestIds } }),
    Assignment.deleteMany({ request: { $in: requestIds } }),
    ChatMessage.deleteMany({ request: { $in: requestIds } }),
    LiveLocation.deleteMany({ request: { $in: requestIds } }),
    RescueRequest.deleteMany({ _id: { $in: requestIds } }),
    Customer.updateMany(
      {},
      { $pull: { emergencyContacts: { phone: '+233201111222' } } },
    ),
  ]);

  console.log(`Removed ${requestIds.length} seeded rescue requests and demo contacts.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => undefined);
  });
