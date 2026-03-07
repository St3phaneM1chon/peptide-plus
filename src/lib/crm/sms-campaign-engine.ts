/**
 * SMS CAMPAIGN ENGINE
 * Handles sending SMS campaigns with rate limiting, tracking, retry logic,
 * opt-out scrubbing, and status updates.
 */

import { prisma } from '@/lib/db';
import { sendSms } from '@/lib/sms';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SMS_PER_SECOND = 1; // 1 SMS per second per source number
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [5_000, 15_000, 45_000]; // Exponential backoff
const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CampaignSendResult {
  campaignId: string;
  sent: number;
  failed: number;
  skipped: number;
  optedOut: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Replace merge variables in a message template.
 * Supports {firstName}, {companyName}, {email}, etc.
 */
function mergeVariables(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return vars[key] ?? '';
  });
}

// ---------------------------------------------------------------------------
// Campaign execution
// ---------------------------------------------------------------------------

/**
 * Send all pending messages for a campaign.
 * Processes in batches with rate limiting and opt-out scrubbing.
 */
export async function executeCampaign(campaignId: string): Promise<CampaignSendResult> {
  const campaign = await prisma.smsCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { template: true },
  });

  if (campaign.status !== 'SENDING') {
    throw new Error(`Campaign is not in SENDING status (current: ${campaign.status})`);
  }

  const messageTemplate = campaign.message || campaign.template?.body || '';
  if (!messageTemplate) {
    throw new Error('Campaign has no message body');
  }

  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalOptedOut = 0;

  // Process messages in batches
  let hasMore = true;
  while (hasMore) {
    // Check if campaign was paused
    const currentStatus = await prisma.smsCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (currentStatus?.status === 'PAUSED') {
      logger.info('Campaign paused, stopping execution', { campaignId });
      break;
    }

    const pendingMessages = await prisma.smsCampaignMessage.findMany({
      where: {
        campaignId,
        status: 'PENDING',
      },
      include: {
        recipient: {
          select: { name: true, email: true },
        },
      },
      take: BATCH_SIZE,
    });

    if (pendingMessages.length === 0) {
      hasMore = false;
      break;
    }

    // Batch opt-out check: collect all phone numbers and check at once
    const allPhones = pendingMessages.map(m => m.phone);
    const normalizedPhoneVariants = allPhones.flatMap(phone => {
      const normalised = phone.replace(/\D/g, '');
      return [phone, normalised, `+${normalised}`, `+1${normalised}`];
    });
    const optedOutRecords = await prisma.smsOptOut.findMany({
      where: { phone: { in: normalizedPhoneVariants } },
      select: { phone: true },
    });
    const optedOutPhones = new Set(optedOutRecords.map(r => r.phone));
    const isPhoneOptedOut = (phone: string): boolean => {
      const normalised = phone.replace(/\D/g, '');
      return optedOutPhones.has(phone) || optedOutPhones.has(normalised) ||
             optedOutPhones.has(`+${normalised}`) || optedOutPhones.has(`+1${normalised}`);
    };

    for (const msg of pendingMessages) {
      // Check opt-out (using batch-fetched data)
      if (isPhoneOptedOut(msg.phone)) {
        await prisma.smsCampaignMessage.update({
          where: { id: msg.id },
          data: { status: 'OPTED_OUT' },
        });
        totalOptedOut++;
        continue;
      }

      // Merge variables
      const body = mergeVariables(messageTemplate, {
        firstName: msg.recipient?.name?.split(' ')[0] ?? '',
        name: msg.recipient?.name ?? '',
        email: msg.recipient?.email ?? '',
      });

      // Send with retries
      let sent = false;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const success = await sendSms({ to: msg.phone, body, userId: msg.recipientId ?? undefined });
          if (success) {
            sent = true;
            break;
          }
        } catch (err) {
          logger.warn('SMS send attempt failed', {
            campaignId,
            messageId: msg.id,
            attempt: attempt + 1,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_BACKOFF_MS[attempt] ?? 5_000);
        }
      }

      if (sent) {
        await prisma.smsCampaignMessage.update({
          where: { id: msg.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        totalSent++;
      } else {
        await prisma.smsCampaignMessage.update({
          where: { id: msg.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Delivery failed after retries',
          },
        });
        totalFailed++;
      }

      // Rate limiting: 1 SMS per second
      await sleep(1000 / MAX_SMS_PER_SECOND);
    }
  }

  // Update campaign totals
  // Only mark COMPLETED if all messages are processed
  const remainingPending = await prisma.smsCampaignMessage.count({
    where: { campaignId, status: 'PENDING' },
  });

  // Re-fetch current status to check if paused during execution
  const latestCampaign = await prisma.smsCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });

  await prisma.smsCampaign.update({
    where: { id: campaignId },
    data: {
      sent: { increment: totalSent },
      failed: { increment: totalFailed },
      optedOut: { increment: totalOptedOut },
      ...(remainingPending === 0 && latestCampaign?.status === 'SENDING'
        ? { status: 'COMPLETED', completedAt: new Date() }
        : {}),
    },
  });

  logger.info('Campaign execution complete', {
    campaignId,
    sent: totalSent,
    failed: totalFailed,
    skipped: totalSkipped,
    optedOut: totalOptedOut,
    remainingPending,
  });

  return {
    campaignId,
    sent: totalSent,
    failed: totalFailed,
    skipped: totalSkipped,
    optedOut: totalOptedOut,
  };
}

/**
 * Handle an inbound SMS — check for STOP/ARRET/UNSUBSCRIBE keywords
 * and add to SmsOptOut if matched.
 */
export async function handleInboundSms(
  phone: string,
  body: string,
): Promise<{ optedOut: boolean }> {
  const normalised = body.trim().toUpperCase();
  const stopKeywords = ['STOP', 'ARRET', 'ARRÊT', 'UNSUBSCRIBE', 'DESABONNER', 'DÉSABONNER'];

  if (stopKeywords.includes(normalised)) {
    const cleanPhone = phone.replace(/\D/g, '');
    await prisma.smsOptOut.upsert({
      where: { phone: cleanPhone },
      update: { reason: `Inbound STOP: ${normalised}` },
      create: { phone: cleanPhone, reason: `Inbound STOP: ${normalised}` },
    });

    logger.info('SMS opt-out processed', { phone: cleanPhone, keyword: normalised });
    return { optedOut: true };
  }

  return { optedOut: false };
}
