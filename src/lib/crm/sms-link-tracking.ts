/**
 * CRM SMS Link Tracking - G8
 *
 * Generates short tracking URLs for SMS campaigns and records clicks
 * with timestamp, IP address, and user-agent. Tracking data is stored
 * in SmsCampaignMessage metadata for campaign analytics.
 *
 * Short URLs are stored in an in-memory map backed by the database
 * via SmsCampaignMessage metadata. In production, this should use Redis
 * for fast lookups across instances.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrackingLink {
  id: string;
  shortCode: string;
  originalUrl: string;
  campaignId: string;
  contactId?: string;
  messageId?: string;
  createdAt: string;
}

export interface ClickEvent {
  trackingId: string;
  clickedAt: string;
  ip?: string;
  userAgent?: string;
  referer?: string;
}

export interface ClickStats {
  campaignId: string;
  totalLinks: number;
  totalClicks: number;
  uniqueClickers: number;
  clicksByLink: Array<{
    originalUrl: string;
    clicks: number;
  }>;
}

// ---------------------------------------------------------------------------
// In-memory link store (production: use Redis)
// ---------------------------------------------------------------------------

const linkStore = new Map<string, TrackingLink & { clicks: ClickEvent[] }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_URL || process.env.NEXTAUTH_URL || 'https://attitudes.vip';
}

// ---------------------------------------------------------------------------
// createTrackingLink
// ---------------------------------------------------------------------------

/**
 * Create a short tracking URL that redirects to the original URL.
 * The short URL is suitable for SMS (keeps message length down).
 *
 * @param originalUrl - The destination URL to track
 * @param campaignId - The SMS campaign ID
 * @param contactId - Optional contact/user ID for per-recipient tracking
 * @returns The tracking link with short URL
 */
export async function createTrackingLink(
  originalUrl: string,
  campaignId: string,
  contactId?: string,
): Promise<{ trackingId: string; shortUrl: string; originalUrl: string }> {
  const shortCode = generateShortCode();
  const trackingId = `trk-${Date.now()}-${shortCode}`;

  const link: TrackingLink & { clicks: ClickEvent[] } = {
    id: trackingId,
    shortCode,
    originalUrl,
    campaignId,
    contactId,
    createdAt: new Date().toISOString(),
    clicks: [],
  };

  linkStore.set(shortCode, link);

  // Persist to campaign metadata for durability
  await persistLinkToDb(campaignId, link);

  const shortUrl = `${getBaseUrl()}/r/${shortCode}`;

  logger.info('SMS link tracking: link created', {
    event: 'tracking_link_created',
    trackingId,
    shortCode,
    campaignId,
    contactId,
    originalUrl,
  });

  return { trackingId, shortUrl, originalUrl };
}

// ---------------------------------------------------------------------------
// handleLinkClick
// ---------------------------------------------------------------------------

/**
 * Record a click on a tracking link and return the original URL for redirect.
 *
 * @param shortCode - The short code from the URL path
 * @param meta - Optional click metadata (IP, user-agent)
 * @returns The original URL to redirect to, or null if not found
 */
export async function handleLinkClick(
  shortCode: string,
  meta?: { ip?: string; userAgent?: string; referer?: string },
): Promise<string | null> {
  let link = linkStore.get(shortCode);

  // If not in memory, try loading from database
  if (!link) {
    link = await loadLinkFromDb(shortCode);
    if (link) {
      linkStore.set(shortCode, link);
    }
  }

  if (!link) {
    logger.warn('SMS link tracking: short code not found', {
      event: 'tracking_link_not_found',
      shortCode,
    });
    return null;
  }

  const clickEvent: ClickEvent = {
    trackingId: link.id,
    clickedAt: new Date().toISOString(),
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    referer: meta?.referer,
  };

  link.clicks.push(clickEvent);

  // Update database
  await persistClickToDb(link.campaignId, link.id, clickEvent);

  logger.info('SMS link tracking: click recorded', {
    event: 'tracking_link_clicked',
    shortCode,
    trackingId: link.id,
    campaignId: link.campaignId,
    contactId: link.contactId,
    totalClicks: link.clicks.length,
  });

  return link.originalUrl;
}

// ---------------------------------------------------------------------------
// getClickStats
// ---------------------------------------------------------------------------

/**
 * Get aggregated click statistics for an SMS campaign.
 */
export async function getClickStats(campaignId: string): Promise<ClickStats> {
  const links: Array<TrackingLink & { clicks: ClickEvent[] }> = [];

  // Collect from in-memory store
  linkStore.forEach((link) => {
    if (link.campaignId === campaignId) {
      links.push(link);
    }
  });

  const totalClicks = links.reduce((sum, l) => sum + l.clicks.length, 0);
  const uniqueContactIds = new Set(
    links.filter((l) => l.contactId).map((l) => l.contactId),
  );

  // Group clicks by original URL
  const urlClickMap = new Map<string, number>();
  for (const link of links) {
    const current = urlClickMap.get(link.originalUrl) || 0;
    urlClickMap.set(link.originalUrl, current + link.clicks.length);
  }

  const clicksByLink = Array.from(urlClickMap.entries()).map(
    ([originalUrl, clicks]) => ({ originalUrl, clicks }),
  );

  return {
    campaignId,
    totalLinks: links.length,
    totalClicks,
    uniqueClickers: uniqueContactIds.size,
    clicksByLink,
  };
}

// ---------------------------------------------------------------------------
// DB persistence helpers
// ---------------------------------------------------------------------------

async function persistLinkToDb(
  campaignId: string,
  link: TrackingLink,
): Promise<void> {
  try {
    // Store in SmsCampaign metadata (segmentCriteria JSON field)
    const campaign = await prisma.smsCampaign.findFirst({
      where: { id: campaignId },
      select: { id: true, segmentCriteria: true },
    });

    if (!campaign) return;

    const meta = (campaign.segmentCriteria as Record<string, unknown>) || {};
    const trackingLinks = (meta.trackingLinks as TrackingLink[]) || [];
    trackingLinks.push(link);
    meta.trackingLinks = trackingLinks;

    await prisma.smsCampaign.update({
      where: { id: campaign.id },
      data: { segmentCriteria: meta as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    logger.warn('SMS link tracking: failed to persist link', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function persistClickToDb(
  campaignId: string,
  _trackingId: string,
  click: ClickEvent,
): Promise<void> {
  try {
    const campaign = await prisma.smsCampaign.findFirst({
      where: { id: campaignId },
      select: { id: true, segmentCriteria: true },
    });

    if (!campaign) return;

    const meta = (campaign.segmentCriteria as Record<string, unknown>) || {};
    const clicks = (meta.clickEvents as ClickEvent[]) || [];
    clicks.push(click);
    meta.clickEvents = clicks;

    await prisma.smsCampaign.update({
      where: { id: campaign.id },
      data: { segmentCriteria: meta as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    logger.warn('SMS link tracking: failed to persist click', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function loadLinkFromDb(
  shortCode: string,
): Promise<(TrackingLink & { clicks: ClickEvent[] }) | undefined> {
  // Search across campaigns for the short code
  const campaigns = await prisma.smsCampaign.findMany({
    where: { segmentCriteria: { not: Prisma.DbNull } },
    select: { segmentCriteria: true },
    take: 100,
  });

  for (const campaign of campaigns) {
    const meta = (campaign.segmentCriteria as Record<string, unknown>) || {};
    const links = (meta.trackingLinks as TrackingLink[]) || [];
    const found = links.find((l) => l.shortCode === shortCode);
    if (found) {
      const clicks = (meta.clickEvents as ClickEvent[]) || [];
      const relatedClicks = clicks.filter((c) => c.trackingId === found.id);
      return { ...found, clicks: relatedClicks };
    }
  }

  return undefined;
}
