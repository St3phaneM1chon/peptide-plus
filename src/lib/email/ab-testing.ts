/**
 * A/B Testing Orchestration for Email Campaigns
 *
 * Splits recipients into A/B groups, sends variant subjects,
 * and after a configurable wait period the cron (/api/cron/ab-test-check)
 * picks the winner by open-rate and sends it to the remainder.
 *
 * This file provides the split + initial send logic.
 * The winner evaluation + remainder send lives in /api/cron/ab-test-check.
 */

import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { escapeHtml } from '@/lib/email/templates/base-template';
import { logger } from '@/lib/logger';

export interface ABTestConfig {
  /** Subject line for variant A */
  subjectA: string;
  /** Subject line for variant B */
  subjectB: string;
  /** HTML content for variant A (optional, defaults to campaign htmlContent) */
  htmlContentA?: string;
  /** HTML content for variant B (optional, defaults to campaign htmlContent) */
  htmlContentB?: string;
  /** Percentage of total audience for A/B test pool (default: 20 => 10% A, 10% B) */
  testPoolPercent?: number;
  /** Minutes to wait before checking winner (default: 240 = 4 hours) */
  waitMinutes?: number;
  /** Metric to evaluate winner (default: open_rate) */
  metric?: 'open_rate' | 'click_rate';
  /** Statistical confidence level (default: 0.95) */
  confidenceLevel?: number;
}

export interface ABTestResult {
  campaignId: string;
  groupACount: number;
  groupBCount: number;
  remainderCount: number;
  sentA: number;
  sentB: number;
  failedA: number;
  failedB: number;
  checkWinnerAfter: string;
}

/**
 * Fisher-Yates shuffle for unbiased random assignment.
 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Launch an A/B test for an email campaign.
 *
 * 1. Splits recipients into A (test%), B (test%), remainder
 * 2. Sends variant A subject to group A, variant B to group B
 * 3. Sets campaign status to AB_TESTING with metadata
 * 4. The cron /api/cron/ab-test-check picks up after waitMinutes
 */
export async function launchABTest(
  campaignId: string,
  recipients: Array<{ id: string; email: string; name: string | null }>,
  config: ABTestConfig
): Promise<ABTestResult> {
  const testPoolPercent = config.testPoolPercent ?? 20;
  const waitMinutes = config.waitMinutes ?? 240;
  const metric = config.metric ?? 'open_rate';
  const confidenceLevel = config.confidenceLevel ?? 0.95;

  // Calculate group sizes
  const totalRecipients = recipients.length;
  const testPoolSize = Math.max(2, Math.floor(totalRecipients * (testPoolPercent / 100)));
  const groupSize = Math.floor(testPoolSize / 2);
  const remainderCount = totalRecipients - groupSize * 2;

  // Shuffle and split
  const shuffled = fisherYatesShuffle(recipients);
  const groupA = shuffled.slice(0, groupSize);
  const groupB = shuffled.slice(groupSize, groupSize * 2);
  // Remainder stays unsent until winner is determined

  // Fetch campaign
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const htmlA = config.htmlContentA || campaign.htmlContent;
  const htmlB = config.htmlContentB || campaign.htmlContent;

  // Track timing
  const now = new Date();
  const checkWinnerAfter = new Date(now.getTime() + waitMinutes * 60 * 1000);

  let sentA = 0;
  let failedA = 0;
  let sentB = 0;
  let failedB = 0;

  // Send to Group A
  for (const recipient of groupA) {
    try {
      const { suppressed } = await shouldSuppressEmail(recipient.email);
      if (suppressed) { failedA++; continue; }

      const safeName = escapeHtml(recipient.name || 'Client');
      const subject = config.subjectA.replace(/\{\{prenom\}\}/g, recipient.name || 'Client');
      const html = htmlA
        .replace(/\{\{prenom\}\}/g, safeName)
        .replace(/\{\{email\}\}/g, escapeHtml(recipient.email));

      const unsubscribeUrl = await generateUnsubscribeUrl(recipient.email, 'marketing', recipient.id).catch(() => undefined);

      const emailLog = await prisma.emailLog.create({
        data: {
          to: recipient.email,
          subject,
          status: 'sending',
          templateId: `campaign:${campaignId}`,
          abVariant: 'A',
          campaignId,
          userId: recipient.id,
        },
      });

      const result = await sendEmail({
        to: { email: recipient.email, name: recipient.name || undefined },
        subject,
        html,
        tags: ['campaign', campaignId, 'ab-test', 'variant-a'],
        unsubscribeUrl,
        emailType: 'marketing',
        emailLogId: emailLog.id,
      });

      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: result.success ? 'sent' : 'failed',
          messageId: result.messageId || undefined,
          error: result.success ? null : (result.error || 'Send failed'),
        },
      });

      if (result.success) sentA++;
      else failedA++;
    } catch (error) {
      logger.error('[AB Testing] Failed to send variant A', {
        campaignId,
        email: recipient.email,
        error: error instanceof Error ? error.message : String(error),
      });
      failedA++;
    }
  }

  // Send to Group B
  for (const recipient of groupB) {
    try {
      const { suppressed } = await shouldSuppressEmail(recipient.email);
      if (suppressed) { failedB++; continue; }

      const safeName = escapeHtml(recipient.name || 'Client');
      const subject = config.subjectB.replace(/\{\{prenom\}\}/g, recipient.name || 'Client');
      const html = htmlB
        .replace(/\{\{prenom\}\}/g, safeName)
        .replace(/\{\{email\}\}/g, escapeHtml(recipient.email));

      const unsubscribeUrl = await generateUnsubscribeUrl(recipient.email, 'marketing', recipient.id).catch(() => undefined);

      const emailLog = await prisma.emailLog.create({
        data: {
          to: recipient.email,
          subject,
          status: 'sending',
          templateId: `campaign:${campaignId}`,
          abVariant: 'B',
          campaignId,
          userId: recipient.id,
        },
      });

      const result = await sendEmail({
        to: { email: recipient.email, name: recipient.name || undefined },
        subject,
        html,
        tags: ['campaign', campaignId, 'ab-test', 'variant-b'],
        unsubscribeUrl,
        emailType: 'marketing',
        emailLogId: emailLog.id,
      });

      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: result.success ? 'sent' : 'failed',
          messageId: result.messageId || undefined,
          error: result.success ? null : (result.error || 'Send failed'),
        },
      });

      if (result.success) sentB++;
      else failedB++;
    } catch (error) {
      logger.error('[AB Testing] Failed to send variant B', {
        campaignId,
        email: recipient.email,
        error: error instanceof Error ? error.message : String(error),
      });
      failedB++;
    }
  }

  // Update campaign with A/B test metadata
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: 'AB_TESTING',
      sentAt: now,
      abTestConfig: JSON.stringify({
        variantA: { subject: config.subjectA, htmlContent: htmlA },
        variantB: { subject: config.subjectB, htmlContent: htmlB },
      }),
      stats: JSON.stringify({
        sent: sentA + sentB,
        failed: failedA + failedB,
        sentCount: sentA + sentB + failedA + failedB,
        abTest: {
          status: 'RUNNING',
          variantA: {
            id: 'A',
            name: 'Variant A',
            subject: config.subjectA,
            percentage: 50,
            sent: sentA + failedA,
            opens: 0,
            clicks: 0,
            conversions: 0,
          },
          variantB: {
            id: 'B',
            name: 'Variant B',
            subject: config.subjectB,
            percentage: 50,
            sent: sentB + failedB,
            opens: 0,
            clicks: 0,
            conversions: 0,
          },
          remainderCount,
          winningMetric: metric,
          confidenceLevel,
          waitDurationMinutes: waitMinutes,
          testStartedAt: now.toISOString(),
          checkWinnerAfter: checkWinnerAfter.toISOString(),
        },
      }),
    },
  });

  logger.info('[AB Testing] Test launched', {
    campaignId,
    groupACount: groupA.length,
    groupBCount: groupB.length,
    remainderCount,
    sentA,
    sentB,
    checkWinnerAfter: checkWinnerAfter.toISOString(),
  });

  return {
    campaignId,
    groupACount: groupA.length,
    groupBCount: groupB.length,
    remainderCount,
    sentA,
    sentB,
    failedA,
    failedB,
    checkWinnerAfter: checkWinnerAfter.toISOString(),
  };
}
