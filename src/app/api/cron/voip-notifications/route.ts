export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/voip-notifications
 * Cron job to send email notifications for missed calls and new voicemails.
 *
 * Runs every 10 minutes. Looks for:
 * 1. CallLog entries with status MISSED that haven't been notified
 * 2. Voicemail entries that are unread and not yet notified
 *
 * Sends email to the agent assigned to the extension.
 *
 * Authentication: Requires CRON_SECRET in Authorization header
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured');
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch { secretsMatch = false; }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('voip-notifications', async () => {
    let missedCallsNotified = 0;
    let voicemailsNotified = 0;

    try {
      // ------------------------------------------------------------------
      // 1. Missed call notifications
      // ------------------------------------------------------------------
      // Find missed calls from the last 30 minutes that have an agent
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

      const missedCalls = await prisma.callLog.findMany({
        where: {
          status: 'MISSED',
          startedAt: { gte: thirtyMinAgo },
          agentId: { not: null },
          // Use tags to track notification state (avoid adding a column)
          NOT: { tags: { has: 'notified' } },
        },
        include: {
          agent: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
        },
        take: 50,
      });

      for (const call of missedCalls) {
        const agentEmail = call.agent?.user?.email;
        if (!agentEmail) continue;

        try {
          await sendEmail({
            to: { email: agentEmail, name: call.agent?.user?.name || undefined },
            subject: `Appel manqué de ${call.callerName || call.callerNumber}`,
            html: buildMissedCallEmail(call),
            tags: ['voip', 'missed-call'],
            emailType: 'transactional',
          });

          // Mark as notified via tags
          await prisma.callLog.update({
            where: { id: call.id },
            data: { tags: { push: 'notified' } },
          });

          missedCallsNotified++;
        } catch (err) {
          logger.warn('[VoIP Notify] Failed to send missed call email', {
            callId: call.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // ------------------------------------------------------------------
      // 2. Voicemail notifications
      // ------------------------------------------------------------------
      const voicemails = await prisma.voicemail.findMany({
        where: {
          isRead: false,
          isArchived: false,
          createdAt: { gte: thirtyMinAgo },
        },
        include: {
          extension: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
        },
        take: 50,
      });

      for (const vm of voicemails) {
        const agentEmail = vm.extension?.user?.email;
        if (!agentEmail) continue;

        try {
          await sendEmail({
            to: { email: agentEmail, name: vm.extension?.user?.name || undefined },
            subject: `Nouveau message vocal de ${vm.callerName || vm.callerNumber}`,
            html: buildVoicemailEmail(vm),
            tags: ['voip', 'voicemail'],
            emailType: 'transactional',
          });

          voicemailsNotified++;
        } catch (err) {
          logger.warn('[VoIP Notify] Failed to send voicemail email', {
            voicemailId: vm.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      logger.info('[Cron] voip-notifications completed', {
        missedCallsNotified,
        voicemailsNotified,
      });

      return NextResponse.json({
        success: true,
        missedCallsNotified,
        voicemailsNotified,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Cron] voip-notifications failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Notification processing failed' },
        { status: 500 }
      );
    }
  }, { maxDurationMs: 2 * 60 * 1000 }); // 2 min timeout
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

interface MissedCallData {
  callerNumber: string;
  callerName: string | null;
  startedAt: Date;
}

function buildMissedCallEmail(call: MissedCallData): string {
  const time = call.startedAt.toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'BioCycle Peptides';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 16px;">Appel manqué</h2>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 16px; font-weight: 600;">
          ${call.callerName || 'Appelant inconnu'}
        </p>
        <p style="margin: 4px 0 0; color: #6b7280;">
          ${call.callerNumber} &middot; ${time}
        </p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        Vous pouvez rappeler cet appelant depuis votre
        <a href="${appUrl}/admin/telephonie" style="color: #0ea5e9;">tableau de bord téléphonie</a>.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">${appName}</p>
    </div>
  `;
}

interface VoicemailData {
  callerNumber: string;
  callerName: string | null;
  durationSec: number | null;
  transcription: string | null;
  createdAt: Date;
}

function buildVoicemailEmail(vm: VoicemailData): string {
  const time = vm.createdAt.toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const duration = vm.durationSec ? `${Math.floor(vm.durationSec / 60)}:${String(vm.durationSec % 60).padStart(2, '0')}` : '';
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'BioCycle Peptides';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 16px;">Nouveau message vocal</h2>
      <div style="background: #ede9fe; border-left: 4px solid #8b5cf6; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 16px; font-weight: 600;">
          ${vm.callerName || 'Appelant inconnu'}
        </p>
        <p style="margin: 4px 0 0; color: #6b7280;">
          ${vm.callerNumber} &middot; ${time}${duration ? ` &middot; ${duration}` : ''}
        </p>
      </div>
      ${vm.transcription ? `
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af;">Transcription</p>
          <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">${vm.transcription}</p>
        </div>
      ` : ''}
      <p style="color: #6b7280; font-size: 14px;">
        Écoutez ce message dans votre
        <a href="${appUrl}/admin/telephonie/messagerie" style="color: #0ea5e9;">boîte vocale</a>.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">${appName}</p>
    </div>
  `;
}
