import { emailService } from '../email/index.js';
import { env } from '../config/env.js';

async function main(): Promise<void> {
  const to = process.argv[2]?.trim();
  if (!to) {
    console.error('Usage: npm run email:test -- you@example.com');
    process.exitCode = 1;
    return;
  }

  console.log(`brevo_configured=${emailService.isConfigured()}`);
  console.log(`sender=${env.BREVO_SENDER_NAME} <${env.BREVO_SENDER_EMAIL}>`);
  console.log(`client_origin=${env.PRIMARY_CLIENT_ORIGIN}`);

  const result = await emailService.sendTestEmail(to);
  console.log(JSON.stringify(result, null, 2));
  if (!result.sent) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
