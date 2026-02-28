/**
 * Auto Consent Reminders
 * C-16: Sends reminder emails 7 days before consent expiration.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReminderResult {
  sent: number;
  errors: number;
  details: Array<{ consentId: string; email: string; status: string }>;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Find consents expiring in the next N days and send reminder emails.
 * Should be called daily by a cron job.
 */
export async function sendConsentExpirationReminders(daysBeforeExpiry = 7): Promise<ReminderResult> {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);

  try {
    // Find GRANTED consents that expire within the window
    const expiringConsents = await prisma.siteConsent.findMany({
      where: {
        status: 'GRANTED',
        expiresAt: {
          gte: now,
          lte: targetDate,
        },
        // Don't remind if already reminded (check reminderSentAt if field exists)
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        video: { select: { id: true, title: true } },
      },
    });

    logger.info(`[ConsentReminders] Found ${expiringConsents.length} consents expiring in ${daysBeforeExpiry} days`);

    const result: ReminderResult = { sent: 0, errors: 0, details: [] };

    for (const consent of expiringConsents) {
      const email = consent.client?.email;
      if (!email) {
        result.details.push({ consentId: consent.id, email: 'N/A', status: 'skipped_no_email' });
        continue;
      }

      try {
        // Send reminder email (uses existing email infrastructure)
        const emailModule = await import('@/lib/email');
        if (typeof emailModule.sendEmail === 'function') {
          const daysLeft = Math.ceil((new Date(consent.expiresAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          await emailModule.sendEmail({
            to: email,
            subject: `Consent Expiration Reminder - ${consent.video?.title || 'Video'}`,
            html: `
              <p>Dear ${consent.client?.name || 'Client'},</p>
              <p>Your consent for the video "<strong>${consent.video?.title || 'Unknown'}</strong>" expires in <strong>${daysLeft} days</strong>.</p>
              <p>Please review and renew your consent if you wish to continue.</p>
              <p>Best regards,<br>BioCycle Peptides Team</p>
            `,
          });
          result.sent++;
          result.details.push({ consentId: consent.id, email, status: 'sent' });
        }
      } catch (emailError) {
        result.errors++;
        result.details.push({
          consentId: consent.id,
          email,
          status: `error: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
        });
        logger.error('[ConsentReminders] Email send failed', { consentId: consent.id, email });
      }
    }

    logger.info(`[ConsentReminders] Completed: ${result.sent} sent, ${result.errors} errors`);
    return result;
  } catch (error) {
    logger.error('[ConsentReminders] Error', { error: error instanceof Error ? error.message : String(error) });
    return { sent: 0, errors: 1, details: [] };
  }
}
