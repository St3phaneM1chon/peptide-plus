export const dynamic = 'force-dynamic';

/**
 * CRON Job - Automated Aging Reminders for Overdue Invoices
 *
 * Sends payment reminder emails to customers with overdue invoices.
 * Uses a 3-stage escalation process:
 *
 *   Stage 1 (GENTLE): 7+ days past due, remindersSent = 0
 *     -> Friendly payment reminder
 *
 *   Stage 2 (FIRM): 30+ days past due, remindersSent = 1
 *     -> Firm reminder with consequences mention
 *
 *   Stage 3 (FINAL): 60+ days past due, remindersSent = 2
 *     -> Final notice before collection action
 *
 * Tracking:
 *   - Uses the `remindersSent` (Int) and `lastReminderAt` (DateTime?) fields
 *     on the CustomerInvoice model to track reminder stages.
 *   - Ensures we don't re-send the same stage within 7 days.
 *
 * Schedule: Daily at 8:00 AM (0 8 * * *)
 *
 * Authentication: Requires Bearer token matching CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withJobLock } from '@/lib/cron-lock';
import { sendEmail } from '@/lib/email/email-service';
import { baseTemplate } from '@/lib/email/templates/base-template';
import { logAuditTrail } from '@/lib/accounting';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum days between reminder sends for the same invoice */
const MIN_DAYS_BETWEEN_REMINDERS = 7;

/** Maximum invoices to process per cron run to avoid timeouts */
const BATCH_SIZE = 50;

/** Reminder stage thresholds (days past due) */
const STAGE_THRESHOLDS = {
  GENTLE: 7,    // remindersSent 0 -> 1
  FIRM: 30,     // remindersSent 1 -> 2
  FINAL: 60,    // remindersSent 2 -> 3
} as const;

type ReminderStage = 'GENTLE' | 'FIRM' | 'FINAL';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

function buildReminderEmail(
  stage: ReminderStage,
  invoice: {
    invoiceNumber: string;
    customerName: string;
    total: number;
    balance: number;
    dueDate: Date;
    daysPastDue: number;
  }
): { subject: string; html: string } {
  const formatCAD = (n: number) => `$${n.toFixed(2)} CAD`;
  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let subject: string;
  let heading: string;
  let bodyText: string;
  let urgencyColor: string;

  switch (stage) {
    case 'GENTLE':
      subject = `Rappel de paiement - Facture ${invoice.invoiceNumber}`;
      heading = 'Rappel amical de paiement';
      urgencyColor = '#f59e0b'; // amber
      bodyText = `
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Nous souhaitons vous rappeler que la facture <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
          est en attente de paiement depuis <strong>${invoice.daysPastDue} jours</strong>.
        </p>
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Il est possible que ce paiement ait deja ete effectue. Si c'est le cas, veuillez ignorer ce message.
          Sinon, nous vous serions reconnaissants de bien vouloir proceder au paiement dans les meilleurs delais.
        </p>
      `;
      break;

    case 'FIRM':
      subject = `Rappel urgent - Facture ${invoice.invoiceNumber} en retard de ${invoice.daysPastDue} jours`;
      heading = 'Rappel de paiement important';
      urgencyColor = '#ef4444'; // red
      bodyText = `
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Malgre notre precedent rappel, la facture <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
          reste impayee. Elle est maintenant en retard de <strong>${invoice.daysPastDue} jours</strong>.
        </p>
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Nous vous demandons de bien vouloir regulariser cette situation dans les plus brefs delais.
          Des frais de retard pourraient s'appliquer conformement a nos conditions generales.
        </p>
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Si vous rencontrez des difficultes de paiement, n'hesitez pas a nous contacter
          pour discuter d'un arrangement.
        </p>
      `;
      break;

    case 'FINAL':
      subject = `AVIS FINAL - Facture ${invoice.invoiceNumber} - Action requise immediatement`;
      heading = 'Avis final avant mesures de recouvrement';
      urgencyColor = '#dc2626'; // dark red
      bodyText = `
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          <strong>Ceci est notre dernier avis concernant la facture ${escapeHtml(invoice.invoiceNumber)}</strong>,
          impayee depuis <strong>${invoice.daysPastDue} jours</strong>.
        </p>
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Sans paiement ou prise de contact de votre part dans les <strong>7 prochains jours</strong>,
          nous serons dans l'obligation de transmettre ce dossier a notre service de recouvrement.
        </p>
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Nous preferons resoudre cette situation a l'amiable. Veuillez nous contacter
          immediatement pour discuter des options disponibles.
        </p>
      `;
      break;
  }

  const html = baseTemplate({
    locale: 'fr',
    preheader: `${subject} - ${formatCAD(invoice.balance)}`,
    content: `
      <div style="border-left:4px solid ${urgencyColor};padding-left:16px;margin-bottom:24px;">
        <h1 style="font-size:22px;font-weight:700;color:#1e293b;margin-bottom:8px;">
          ${heading}
        </h1>
      </div>
      <p style="font-size:16px;color:#475569;margin-bottom:24px;">
        Bonjour ${escapeHtml(invoice.customerName)},
      </p>
      ${bodyText}
      <table style="width:100%;border-collapse:collapse;margin:24px 0;background:#f8fafc;border-radius:8px;">
        <tr>
          <td style="padding:12px 16px;font-size:14px;color:#64748b;">Facture</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(invoice.invoiceNumber)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:14px;color:#64748b;">Date d'echeance</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:600;text-align:right;">${formatDate(invoice.dueDate)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:14px;color:#64748b;">Jours de retard</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:600;text-align:right;color:${urgencyColor};">${invoice.daysPastDue} jours</td>
        </tr>
        <tr style="border-top:2px solid #e2e8f0;">
          <td style="padding:12px 16px;font-size:16px;font-weight:700;color:#1e293b;">Solde du</td>
          <td style="padding:12px 16px;font-size:16px;font-weight:700;color:${urgencyColor};text-align:right;">${formatCAD(invoice.balance)}</td>
        </tr>
      </table>
      <p style="font-size:13px;color:#94a3b8;margin-top:24px;">
        Pour toute question, contactez-nous a support@biocyclepeptides.com
      </p>
    `,
  });

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Determine which stage an invoice should receive
// ---------------------------------------------------------------------------

function determineReminderStage(
  daysPastDue: number,
  remindersSent: number
): ReminderStage | null {
  // Stage 3: 60+ days, already sent 2 reminders
  if (daysPastDue >= STAGE_THRESHOLDS.FINAL && remindersSent === 2) {
    return 'FINAL';
  }
  // Stage 2: 30+ days, already sent 1 reminder
  if (daysPastDue >= STAGE_THRESHOLDS.FIRM && remindersSent === 1) {
    return 'FIRM';
  }
  // Stage 1: 7+ days, never sent a reminder
  if (daysPastDue >= STAGE_THRESHOLDS.GENTLE && remindersSent === 0) {
    return 'GENTLE';
  }
  // No reminder needed (already completed all stages, or not overdue enough)
  return null;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('aging-reminders', async () => {
    const startTime = Date.now();
    const results: {
      sent: Array<{ invoiceId: string; invoiceNumber: string; stage: ReminderStage; customerEmail: string }>;
      skipped: Array<{ invoiceId: string; reason: string }>;
      failed: Array<{ invoiceId: string; error: string }>;
    } = {
      sent: [],
      skipped: [],
      failed: [],
    };

    try {
      const now = new Date();
      const minGapDate = new Date(now.getTime() - MIN_DAYS_BETWEEN_REMINDERS * 24 * 60 * 60 * 1000);

      // Find overdue invoices that are not paid, not void, not cancelled, not deleted
      // and where remindersSent < 3 (max 3 stages)
      const overdueInvoices = await prisma.customerInvoice.findMany({
        where: {
          deletedAt: null,
          dueDate: { lt: now },
          status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
          remindersSent: { lt: 3 },
          // Only process invoices that haven't received a reminder recently
          OR: [
            { lastReminderAt: null },
            { lastReminderAt: { lt: minGapDate } },
          ],
        },
        orderBy: { dueDate: 'asc' }, // Oldest first
        take: BATCH_SIZE,
      });

      logger.info('[aging-reminders] Found overdue invoices to process', {
        count: overdueInvoices.length,
      });

      for (const invoice of overdueInvoices) {
        const daysPastDue = Math.floor(
          (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine the appropriate reminder stage
        const stage = determineReminderStage(daysPastDue, invoice.remindersSent);

        if (!stage) {
          results.skipped.push({
            invoiceId: invoice.id,
            reason: `No stage applicable (daysPastDue=${daysPastDue}, remindersSent=${invoice.remindersSent})`,
          });
          continue;
        }

        // Must have a customer email
        if (!invoice.customerEmail) {
          results.skipped.push({
            invoiceId: invoice.id,
            reason: 'No customer email address',
          });
          continue;
        }

        try {
          // Build and send email
          const { subject, html } = buildReminderEmail(stage, {
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            total: Number(invoice.total),
            balance: Number(invoice.balance),
            dueDate: invoice.dueDate,
            daysPastDue,
          });

          const emailResult = await sendEmail({
            to: { email: invoice.customerEmail, name: invoice.customerName },
            subject,
            html,
            tags: ['aging-reminder', stage.toLowerCase()],
            emailType: 'transactional',
          });

          if (!emailResult.success) {
            results.failed.push({
              invoiceId: invoice.id,
              error: emailResult.error || 'Email send failed',
            });
            continue;
          }

          // Update invoice: increment remindersSent and set lastReminderAt
          await prisma.customerInvoice.update({
            where: { id: invoice.id },
            data: {
              remindersSent: invoice.remindersSent + 1,
              lastReminderAt: now,
              // Auto-transition to OVERDUE if still SENT
              ...(invoice.status === 'SENT' ? { status: 'OVERDUE' } : {}),
            },
          });

          // Audit trail
          logAuditTrail({
            entityType: 'CustomerInvoice',
            entityId: invoice.id,
            action: 'REMINDER_SENT',
            field: 'remindersSent',
            oldValue: String(invoice.remindersSent),
            newValue: String(invoice.remindersSent + 1),
            userId: 'system-cron',
            metadata: {
              stage,
              daysPastDue,
              customerEmail: invoice.customerEmail,
              emailMessageId: emailResult.messageId,
              invoiceNumber: invoice.invoiceNumber,
            },
          });

          // Log to EmailLog (non-blocking)
          try {
            await prisma.emailLog.create({
              data: {
                to: invoice.customerEmail,
                subject,
                templateId: `aging-reminder-${stage.toLowerCase()}`,
                status: 'sent',
                messageId: emailResult.messageId || undefined,
              },
            });
          } catch {
            // Non-fatal
          }

          results.sent.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            stage,
            customerEmail: invoice.customerEmail,
          });
        } catch (invoiceError) {
          results.failed.push({
            invoiceId: invoice.id,
            error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError),
          });
        }
      }

      const durationMs = Date.now() - startTime;

      logger.info('[aging-reminders] Cron job completed', {
        durationMs,
        sent: results.sent.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
      });

      return NextResponse.json({
        success: true,
        summary: {
          processed: overdueInvoices.length,
          sent: results.sent.length,
          skipped: results.skipped.length,
          failed: results.failed.length,
          durationMs,
        },
        details: results,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error('[aging-reminders] Cron job failed', {
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        {
          error: 'Erreur lors de l\'envoi des rappels de paiement',
          details: process.env.NODE_ENV === 'development'
            ? (error instanceof Error ? error.message : String(error))
            : undefined,
        },
        { status: 500 }
      );
    }
  }, { maxDurationMs: 120_000 }); // 2 minute timeout for batch processing
}
