import { env } from '../config/env.js';

export type EmailTemplateKey =
  | 'verify_email'
  | 'reset_password'
  | 'welcome'
  | 'mechanic_pending'
  | 'support_complaint';

export interface EmailLinkParams {
  firstName: string;
  actionUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#0f172a;padding:20px 24px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#fbbf24;">Road Rescue Ghana</p>
              <p style="margin:4px 0 0;font-size:12px;color:#cbd5e1;">24/7 roadside assistance</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                Need help? Reply to this email or visit
                <a href="${escapeHtml(env.PRIMARY_CLIENT_ORIGIN)}" style="color:#0f172a;">${escapeHtml(env.PRIMARY_CLIENT_ORIGIN)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<p style="margin:24px 0;">
  <a href="${escapeHtml(url)}" style="display:inline-block;background:#fbbf24;color:#111827;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">
    ${escapeHtml(label)}
  </a>
</p>
<p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;">
  Or copy this link:<br />${escapeHtml(url)}
</p>`;
}

export function getBrevoTemplateId(key: EmailTemplateKey): number | undefined {
  switch (key) {
    case 'verify_email':
      return env.BREVO_TEMPLATE_VERIFY_EMAIL;
    case 'reset_password':
      return env.BREVO_TEMPLATE_RESET_PASSWORD;
    case 'welcome':
      return env.BREVO_TEMPLATE_WELCOME;
    case 'mechanic_pending':
      return env.BREVO_TEMPLATE_MECHANIC_PENDING;
    default:
      return undefined;
  }
}

export function buildVerifyEmailContent(input: EmailLinkParams): {
  subject: string;
  htmlContent: string;
  textContent: string;
  params: Record<string, string>;
} {
  const firstName = escapeHtml(input.firstName);
  const subject = 'Verify your Road Rescue Ghana email';
  const htmlContent = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px;">Hi ${firstName},</p>
     <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
       Confirm your email to finish setting up your Road Rescue Ghana account.
     </p>
     ${ctaButton('Verify email', input.actionUrl)}
     <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">This link expires when you request a new one.</p>`,
  );
  const textContent = `Hi ${input.firstName},\n\nVerify your email: ${input.actionUrl}\n\nRoad Rescue Ghana`;
  return {
    subject,
    htmlContent,
    textContent,
    params: {
      FIRSTNAME: input.firstName,
      VERIFY_URL: input.actionUrl,
    },
  };
}

export function buildResetPasswordContent(input: EmailLinkParams): {
  subject: string;
  htmlContent: string;
  textContent: string;
  params: Record<string, string>;
} {
  const firstName = escapeHtml(input.firstName);
  const subject = 'Reset your Road Rescue Ghana password';
  const htmlContent = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px;">Hi ${firstName},</p>
     <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
       We received a request to reset your password. If you did not ask for this, you can ignore this email.
     </p>
     ${ctaButton('Reset password', input.actionUrl)}
     <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">This link expires in 1 hour.</p>`,
  );
  const textContent = `Hi ${input.firstName},\n\nReset your password: ${input.actionUrl}\n\nThis link expires in 1 hour.\n\nRoad Rescue Ghana`;
  return {
    subject,
    htmlContent,
    textContent,
    params: {
      FIRSTNAME: input.firstName,
      RESET_URL: input.actionUrl,
    },
  };
}

export function buildWelcomeContent(input: { firstName: string; role: string }): {
  subject: string;
  htmlContent: string;
  textContent: string;
  params: Record<string, string>;
} {
  const firstName = escapeHtml(input.firstName);
  const homeUrl = `${env.PRIMARY_CLIENT_ORIGIN}/${input.role}/home`;
  const subject = 'Welcome to Road Rescue Ghana';
  const htmlContent = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px;">Hi ${firstName},</p>
     <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
       Your account is ready. Request roadside help anytime across Ghana.
     </p>
     ${ctaButton('Open Road Rescue', homeUrl)}`,
  );
  const textContent = `Hi ${input.firstName},\n\nWelcome to Road Rescue Ghana.\nOpen the app: ${homeUrl}\n`;
  return {
    subject,
    htmlContent,
    textContent,
    params: {
      FIRSTNAME: input.firstName,
      HOME_URL: homeUrl,
      ROLE: input.role,
    },
  };
}

export function buildMechanicPendingContent(input: { firstName: string; garageName: string }): {
  subject: string;
  htmlContent: string;
  textContent: string;
  params: Record<string, string>;
} {
  const firstName = escapeHtml(input.firstName);
  const garageName = escapeHtml(input.garageName);
  const subject = 'Mechanic application received';
  const htmlContent = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px;">Hi ${firstName},</p>
     <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
       We received your mechanic application for <strong>${garageName}</strong>.
       Our team will review your documents and notify you once verification is complete.
     </p>
     <p style="margin:0;font-size:13px;color:#6b7280;">You can sign in anytime to check your status.</p>`,
  );
  const textContent = `Hi ${input.firstName},\n\nWe received your mechanic application for ${input.garageName}. We will notify you after verification.\n`;
  return {
    subject,
    htmlContent,
    textContent,
    params: {
      FIRSTNAME: input.firstName,
      GARAGE_NAME: input.garageName,
    },
  };
}

export function buildSupportComplaintContent(input: {
  ticketId: string;
  category: string;
  subject: string;
  description: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
}): {
  subject: string;
  htmlContent: string;
  textContent: string;
  params: Record<string, string>;
} {
  const subject = `[Support] ${input.category}: ${input.subject}`;
  const htmlContent = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px;font-weight:700;">New support message</p>
     <p style="margin:0 0 8px;font-size:14px;"><strong>Ticket:</strong> ${escapeHtml(input.ticketId)}</p>
     <p style="margin:0 0 8px;font-size:14px;"><strong>Category:</strong> ${escapeHtml(input.category)}</p>
     <p style="margin:0 0 8px;font-size:14px;"><strong>From:</strong> ${escapeHtml(input.userName)} (${escapeHtml(input.userEmail)})</p>
     <p style="margin:0 0 8px;font-size:14px;"><strong>Phone:</strong> ${escapeHtml(input.userPhone || '—')}</p>
     <p style="margin:0 0 8px;font-size:14px;"><strong>Role:</strong> ${escapeHtml(input.userRole)}</p>
     <p style="margin:16px 0 8px;font-size:14px;font-weight:700;">Subject</p>
     <p style="margin:0 0 12px;font-size:15px;">${escapeHtml(input.subject)}</p>
     <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Message</p>
     <p style="margin:0;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(input.description)}</p>`,
  );
  const textContent = `New support message
Ticket: ${input.ticketId}
Category: ${input.category}
From: ${input.userName} <${input.userEmail}>
Phone: ${input.userPhone || '—'}
Role: ${input.userRole}

Subject: ${input.subject}

${input.description}
`;
  return {
    subject,
    htmlContent,
    textContent,
    params: {
      TICKET_ID: input.ticketId,
      CATEGORY: input.category,
      SUBJECT: input.subject,
      DESCRIPTION: input.description,
      USER_NAME: input.userName,
      USER_EMAIL: input.userEmail,
      USER_PHONE: input.userPhone,
      USER_ROLE: input.userRole,
    },
  };
}

/** Frontend deep-link contract for the FE engineer. */
export function buildAuthActionUrl(
  path: '/auth/verify-email' | '/auth/reset-password',
  token: string,
): string {
  const url = new URL(path, `${env.PRIMARY_CLIENT_ORIGIN}/`);
  url.searchParams.set('token', token);
  return url.toString();
}
