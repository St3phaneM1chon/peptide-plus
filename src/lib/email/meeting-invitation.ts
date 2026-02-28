/**
 * Meeting Invitation Email Template
 * Sends branded BioCycle Peptides email with meeting details
 */

import { sendEmail, type EmailResult } from '@/lib/email/email-service';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRAND_COLOR = '#EA580C';
const COMPANY_NAME = 'BioCycle Peptides';

const PLATFORM_NAMES: Record<string, string> = {
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  'google-meet': 'Google Meet',
  webex: 'Cisco Webex',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeetingInvitationData {
  recipientEmail: string;
  recipientName: string;
  topic: string;
  startTime: string;
  duration: number;
  joinUrl: string;
  platform: string;
  password?: string;
}

// ---------------------------------------------------------------------------
// Email Builder
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function buildInvitationHtml(data: MeetingInvitationData): string {
  const platformName = PLATFORM_NAMES[data.platform] || data.platform;
  const dateFormatted = formatDateTime(data.startTime);

  const passwordRow = data.password
    ? `<tr>
        <td style="padding:8px 12px;font-size:14px;color:#71717a;border-bottom:1px solid #f4f4f5;width:120px;">Password</td>
        <td style="padding:8px 12px;font-size:14px;color:#3f3f46;border-bottom:1px solid #f4f4f5;font-family:monospace;font-weight:600;">${escapeHtml(data.password)}</td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${COMPANY_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                ${COMPANY_NAME}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
                Hello ${escapeHtml(data.recipientName)},
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
                You are invited to a private training session with ${COMPANY_NAME}.
                Please find the details below.
              </p>
              <!-- Meeting Details Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:8px 12px;font-size:14px;color:#71717a;border-bottom:1px solid #f4f4f5;width:120px;">Topic</td>
                  <td style="padding:8px 12px;font-size:14px;color:#3f3f46;border-bottom:1px solid #f4f4f5;font-weight:600;">${escapeHtml(data.topic)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;font-size:14px;color:#71717a;border-bottom:1px solid #f4f4f5;">Date &amp; Time</td>
                  <td style="padding:8px 12px;font-size:14px;color:#3f3f46;border-bottom:1px solid #f4f4f5;">${escapeHtml(dateFormatted)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;font-size:14px;color:#71717a;border-bottom:1px solid #f4f4f5;">Duration</td>
                  <td style="padding:8px 12px;font-size:14px;color:#3f3f46;border-bottom:1px solid #f4f4f5;">${data.duration} minutes</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;font-size:14px;color:#71717a;border-bottom:1px solid #f4f4f5;">Platform</td>
                  <td style="padding:8px 12px;font-size:14px;color:#3f3f46;border-bottom:1px solid #f4f4f5;">${escapeHtml(platformName)}</td>
                </tr>
                ${passwordRow}
              </table>
              <!-- Join Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background-color:${BRAND_COLOR};border-radius:6px;">
                    <a href="${escapeHtml(data.joinUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
                      Join Meeting
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#a1a1aa;line-height:1.5;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 16px;font-size:13px;color:#a1a1aa;line-height:1.5;word-break:break-all;">
                <a href="${escapeHtml(data.joinUrl)}" style="color:${BRAND_COLOR};">${escapeHtml(data.joinUrl)}</a>
              </p>
              <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">
                If you did not expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.6;">
                ${COMPANY_NAME} &mdash; Research-Grade Peptides<br />
                This is a transactional email related to your training session.<br />
                &copy; ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.
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

// ---------------------------------------------------------------------------
// Send Function
// ---------------------------------------------------------------------------

/**
 * Send a meeting invitation email with join link and details.
 */
export async function sendMeetingInvitationEmail(
  data: MeetingInvitationData,
): Promise<EmailResult> {
  try {
    const platformName = PLATFORM_NAMES[data.platform] || data.platform;
    const html = buildInvitationHtml(data);

    return await sendEmail({
      to: { email: data.recipientEmail, name: data.recipientName },
      subject: `${COMPANY_NAME} \u2014 ${platformName} Meeting: ${data.topic}`,
      html,
      emailType: 'transactional',
      tags: ['meeting', 'meeting-invitation', data.platform],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[MeetingInvitation] Failed to send invitation email', {
      recipientEmail: data.recipientEmail,
      platform: data.platform,
      error: message,
    });
    return { success: false, error: message };
  }
}
