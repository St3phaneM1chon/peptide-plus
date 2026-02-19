/**
 * ALERTING SYSTEM - Simple multi-channel alerts
 *
 * Channels:
 *   - Email to admin (always)
 *   - SMS via Twilio if level is 'critical' and Twilio is configured
 *   - Console log (always, for observability)
 *
 * Triggers: payment failure, DB connection error, cron missed, etc.
 */

import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/email-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertLevel = 'critical' | 'warning' | 'info';

interface AlertOptions {
  /** Additional context for the alert (will be JSON-serialized) */
  context?: Record<string, unknown>;
  /** Override admin email recipient */
  adminEmail?: string;
  /** Override admin phone for SMS */
  adminPhone?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_FROM || 'admin@biocyclepeptides.com';

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Send an alert through configured channels.
 *
 * - All levels: structured log + email to admin
 * - Critical: also attempts SMS if Twilio is configured
 */
export async function sendAlert(
  level: AlertLevel,
  message: string,
  options?: AlertOptions
): Promise<void> {
  const context = options?.context;
  const timestamp = new Date().toISOString();

  // 1. Always log
  const logPayload = {
    alertLevel: level,
    alertMessage: message,
    ...(context ? { context } : {}),
    timestamp,
  };

  switch (level) {
    case 'critical':
      logger.error('[ALERT:CRITICAL]', logPayload);
      break;
    case 'warning':
      logger.warn('[ALERT:WARNING]', logPayload);
      break;
    case 'info':
      logger.info('[ALERT:INFO]', logPayload);
      break;
  }

  // 2. Send email to admin (fire-and-forget, don't block caller)
  const adminEmail = options?.adminEmail || ADMIN_EMAIL;

  const emailPromise = sendEmail({
    to: { email: adminEmail, name: 'Admin' },
    subject: `[${level.toUpperCase()}] BioCycle Alert: ${message.substring(0, 80)}`,
    html: buildAlertEmailHtml(level, message, context, timestamp),
    tags: ['alert', level],
  }).catch((err) => {
    logger.error('[alerting] Failed to send alert email', {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // 3. SMS for critical alerts only
  let smsPromise: Promise<void> = Promise.resolve();

  if (level === 'critical') {
    smsPromise = sendCriticalSms(message, options?.adminPhone).catch((err) => {
      logger.error('[alerting] Failed to send critical SMS', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // Wait for both channels (best effort)
  await Promise.allSettled([emailPromise, smsPromise]);
}

// ---------------------------------------------------------------------------
// SMS helper
// ---------------------------------------------------------------------------

async function sendCriticalSms(message: string, adminPhoneOverride?: string): Promise<void> {
  try {
    const { sendSms } = await import('@/lib/sms');

    const phone = adminPhoneOverride || process.env.ADMIN_SMS_PHONE;
    if (!phone) {
      logger.debug('[alerting] No ADMIN_SMS_PHONE configured, skipping SMS');
      return;
    }

    const truncated = message.length > 140 ? message.substring(0, 137) + '...' : message;
    await sendSms({
      to: phone,
      body: `[CRITICAL] BioCycle: ${truncated}`,
    });
  } catch (err) {
    // SMS is best-effort; don't throw
    logger.warn('[alerting] SMS send failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

function buildAlertEmailHtml(
  level: AlertLevel,
  message: string,
  context?: Record<string, unknown>,
  timestamp?: string
): string {
  const levelColors: Record<AlertLevel, string> = {
    critical: '#dc2626',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  const color = levelColors[level];
  const contextHtml = context
    ? `<pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:13px;overflow-x:auto;">${escapeHtml(JSON.stringify(context, null, 2))}</pre>`
    : '';

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:${color};padding:16px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;color:#fff;font-size:18px;">Alert: ${level.toUpperCase()}</h2>
  </div>
  <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;color:#1f2937;margin-top:0;"><strong>${escapeHtml(message)}</strong></p>
    ${contextHtml}
    <p style="font-size:13px;color:#6b7280;margin-bottom:0;">Timestamp: ${timestamp || new Date().toISOString()}</p>
    <p style="font-size:13px;color:#6b7280;">Environment: ${process.env.NODE_ENV || 'unknown'}</p>
  </div>
</div>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export async function alertPaymentFailure(
  errorType: string,
  amount: number,
  customerEmail?: string
): Promise<void> {
  await sendAlert('critical', `Payment failure: ${errorType}`, {
    context: { errorType, amount, customerEmail },
  });
}

export async function alertDbConnectionError(error: string): Promise<void> {
  await sendAlert('critical', `Database connection error: ${error}`, {
    context: { error },
  });
}

export async function alertCronMissed(jobName: string, lastRunAt?: string): Promise<void> {
  await sendAlert('warning', `Cron job missed: ${jobName}`, {
    context: { jobName, lastRunAt },
  });
}
