/**
 * CRM Email Tracking Integration
 *
 * Bridges email engagement events (opens, clicks, replies) to CRM activities.
 * When an email tracked via EmailEngagement matches a CRM lead's email,
 * a CrmActivity is created and the lead's engagement score is updated.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailTrackingEvent {
  recipientEmail: string;
  type: 'open' | 'click' | 'reply' | 'bounce' | 'unsubscribe';
  url?: string; // For click events
  subject?: string;
  timestamp?: Date;
}

// ---------------------------------------------------------------------------
// Process email engagement event into CRM
// ---------------------------------------------------------------------------

/**
 * Process an email tracking event and log it as a CRM activity
 * if the recipient email matches a CRM lead.
 */
export async function processEmailTrackingEvent(event: EmailTrackingEvent): Promise<boolean> {
  const lead = await prisma.crmLead.findFirst({
    where: { email: event.recipientEmail },
    select: { id: true, contactName: true, score: true, assignedToId: true },
  });

  if (!lead) return false;

  const titles: Record<string, string> = {
    open: 'Email opened',
    click: 'Email link clicked',
    reply: 'Email reply received',
    bounce: 'Email bounced',
    unsubscribe: 'Email unsubscribed',
  };

  const descriptions: Record<string, string> = {
    open: `${lead.contactName} opened "${event.subject || 'email'}"`,
    click: `${lead.contactName} clicked ${event.url || 'a link'} in "${event.subject || 'email'}"`,
    reply: `${lead.contactName} replied to "${event.subject || 'email'}"`,
    bounce: `Email to ${event.recipientEmail} bounced`,
    unsubscribe: `${lead.contactName} unsubscribed from emails`,
  };

  // Create CRM activity
  await prisma.crmActivity.create({
    data: {
      type: 'EMAIL',
      title: titles[event.type] || 'Email event',
      description: descriptions[event.type] || event.type,
      leadId: lead.id,
      performedById: lead.assignedToId,
      metadata: {
        trackingEvent: event.type,
        recipientEmail: event.recipientEmail,
        subject: event.subject,
        url: event.url,
      },
    },
  });

  // Update lead score based on engagement
  const scoreBoosts: Record<string, number> = {
    open: 2,
    click: 5,
    reply: 10,
    bounce: -5,
    unsubscribe: -10,
  };

  const boost = scoreBoosts[event.type] || 0;
  if (boost !== 0) {
    const newScore = Math.max(0, Math.min(100, lead.score + boost));
    await prisma.crmLead.update({
      where: { id: lead.id },
      data: {
        score: newScore,
        lastContactedAt: event.type === 'reply' ? new Date() : undefined,
      },
    });
  }

  logger.info('Email tracking event processed for CRM', {
    leadId: lead.id,
    event: event.type,
    email: event.recipientEmail,
  });

  return true;
}

// ---------------------------------------------------------------------------
// Sync recent email engagements to CRM
// ---------------------------------------------------------------------------

/**
 * Scan recent EmailEngagement records and sync new opens/clicks
 * to CRM activities. Designed to run periodically (e.g., every 15 min).
 */
export async function syncEmailEngagementsToCrm(sinceMinutes: number = 15): Promise<number> {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
  let synced = 0;

  // Find recent opens
  const recentOpens = await prisma.emailEngagement.findMany({
    where: {
      openedAt: { gte: since },
      openCount: { gte: 1 },
    },
    select: { recipientEmail: true, subject: true, openedAt: true },
    take: 1000,
  });

  for (const engagement of recentOpens) {
    const processed = await processEmailTrackingEvent({
      recipientEmail: engagement.recipientEmail,
      type: 'open',
      subject: engagement.subject || undefined,
      timestamp: engagement.openedAt || undefined,
    });
    if (processed) synced++;
  }

  // Find recent clicks
  const recentClicks = await prisma.emailEngagement.findMany({
    where: {
      clickedAt: { gte: since },
      clickCount: { gte: 1 },
    },
    select: { recipientEmail: true, subject: true, clickedAt: true, clickedLinks: true },
    take: 1000,
  });

  for (const engagement of recentClicks) {
    const links = engagement.clickedLinks as Array<{ url: string }> | null;
    const processed = await processEmailTrackingEvent({
      recipientEmail: engagement.recipientEmail,
      type: 'click',
      subject: engagement.subject || undefined,
      url: links?.[0]?.url,
      timestamp: engagement.clickedAt || undefined,
    });
    if (processed) synced++;
  }

  if (synced > 0) {
    logger.info('Email engagements synced to CRM', { synced, sinceMinutes });
  }

  return synced;
}
