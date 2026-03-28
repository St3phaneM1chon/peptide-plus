/**
 * Shoppable Links — Short URLs for social sharing
 *
 * Generates short, trackable URLs for products that can be shared on social media.
 * Each link encodes UTM parameters for attribution tracking.
 *
 * Features:
 * - Short URL generation with base62 encoding
 * - UTM parameter auto-generation per platform
 * - Click tracking (stored in DB)
 * - Conversion attribution via UTM + cookie
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'twitter'
  | 'linkedin'
  | 'pinterest'
  | 'whatsapp'
  | 'email'
  | 'sms'
  | 'other';

export interface ShoppableLink {
  id: string;
  shortCode: string;
  fullUrl: string;
  productId: string;
  productName: string;
  platform: SocialPlatform;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
  clicks: number;
  conversions: number;
  revenue: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface CreateLinkInput {
  productSlug: string;
  platform: SocialPlatform;
  campaign?: string;
  content?: string;
  baseUrl: string;
}

export interface LinkClickData {
  shortCode: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Short code generation (base62, 7 chars = ~3.5 trillion combinations)
// ---------------------------------------------------------------------------

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateShortCode(length = 7): string {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => BASE62_CHARS[b % 62])
    .join('');
}

// ---------------------------------------------------------------------------
// UTM presets per platform
// ---------------------------------------------------------------------------

const UTM_PRESETS: Record<SocialPlatform, { source: string; medium: string }> = {
  instagram: { source: 'instagram', medium: 'social' },
  facebook: { source: 'facebook', medium: 'social' },
  tiktok: { source: 'tiktok', medium: 'social' },
  twitter: { source: 'twitter', medium: 'social' },
  linkedin: { source: 'linkedin', medium: 'social' },
  pinterest: { source: 'pinterest', medium: 'social' },
  whatsapp: { source: 'whatsapp', medium: 'messaging' },
  email: { source: 'email', medium: 'email' },
  sms: { source: 'sms', medium: 'sms' },
  other: { source: 'direct', medium: 'referral' },
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Create a shoppable link for a product.
 * The link redirects to the product page with UTM params attached.
 */
export async function createShoppableLink(input: CreateLinkInput): Promise<ShoppableLink> {
  const { productSlug, platform, campaign, content, baseUrl } = input;

  // Look up the product
  const product = await prisma.product.findFirst({
    where: { slug: productSlug, isActive: true },
    select: { id: true, name: true, slug: true },
  });

  if (!product) {
    throw new Error(`Product not found: ${productSlug}`);
  }

  const shortCode = generateShortCode();
  const preset = UTM_PRESETS[platform];
  const utmCampaign = campaign || `social-${platform}-${new Date().toISOString().slice(0, 10)}`;
  const utmContent = content || product.slug;

  // Build the destination URL with UTM params
  const utmParams = new URLSearchParams({
    utm_source: preset.source,
    utm_medium: preset.medium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
  });

  const fullUrl = `${baseUrl}/products/${product.slug}?${utmParams.toString()}`;

  // Persist to the ShoppableLink table (or JSON store if model doesn't exist yet)
  // For now we store in a lightweight key-value approach via the existing DB
  try {
    const record = await prisma.shoppableLink.create({
      data: {
        shortCode,
        fullUrl,
        productId: product.id,
        productName: product.name,
        platform,
        utmSource: preset.source,
        utmMedium: preset.medium,
        utmCampaign,
        utmContent,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      },
    });

    logger.info(`[ShoppableLinks] Created link ${shortCode} for product ${product.name} on ${platform}`);

    return {
      id: record.id,
      shortCode: record.shortCode,
      fullUrl: record.fullUrl,
      productId: record.productId,
      productName: record.productName,
      platform: record.platform as SocialPlatform,
      utmSource: record.utmSource,
      utmMedium: record.utmMedium,
      utmCampaign: record.utmCampaign,
      utmContent: record.utmContent ?? undefined,
      clicks: record.clicks,
      conversions: record.conversions,
      revenue: Number(record.revenue),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt ?? undefined,
    };
  } catch {
    // If the ShoppableLink model doesn't exist yet, return an in-memory representation
    logger.warn('[ShoppableLinks] ShoppableLink model not yet migrated, returning in-memory link');
    return {
      id: shortCode,
      shortCode,
      fullUrl,
      productId: product.id,
      productName: product.name,
      platform,
      utmSource: preset.source,
      utmMedium: preset.medium,
      utmCampaign,
      utmContent,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      createdAt: new Date(),
    };
  }
}

/**
 * Resolve a short code to its destination URL and record the click.
 */
export async function resolveShoppableLink(shortCode: string, clickData?: Partial<LinkClickData>): Promise<string | null> {
  try {
    const link = await prisma.shoppableLink.findFirst({
      where: { shortCode },
      select: { id: true, fullUrl: true, expiresAt: true },
    });

    if (!link) return null;

    // Check expiry
    if (link.expiresAt && link.expiresAt < new Date()) {
      return null;
    }

    // Increment click count (fire-and-forget)
    prisma.shoppableLink.update({
      where: { id: link.id },
      data: { clicks: { increment: 1 } },
    }).catch((err: Error) => {
      logger.warn('[ShoppableLinks] Failed to increment click count', { error: err.message });
    });

    // Record click event if tracking data provided
    if (clickData) {
      prisma.shoppableLinkClick.create({
        data: {
          shoppableLinkId: link.id,
          referrer: clickData.referrer ?? null,
          userAgent: clickData.userAgent ?? null,
          ipHash: clickData.ip ? crypto.createHash('sha256').update(clickData.ip).digest('hex').slice(0, 16) : null,
        },
      }).catch((err: Error) => {
        logger.warn('[ShoppableLinks] Failed to record click', { error: err.message });
      });
    }

    return link.fullUrl;
  } catch {
    logger.warn('[ShoppableLinks] ShoppableLink model not yet available');
    return null;
  }
}

/**
 * Record a conversion (purchase) attributed to a shoppable link via UTM params.
 */
export async function recordConversion(utmSource: string, utmCampaign: string, revenue: number): Promise<void> {
  try {
    const link = await prisma.shoppableLink.findFirst({
      where: { utmSource, utmCampaign },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (link) {
      await prisma.shoppableLink.update({
        where: { id: link.id },
        data: {
          conversions: { increment: 1 },
          revenue: { increment: revenue },
        },
      });
      logger.info(`[ShoppableLinks] Conversion recorded: ${utmSource}/${utmCampaign} — $${revenue}`);
    }
  } catch {
    logger.warn('[ShoppableLinks] Could not record conversion (model may not exist yet)');
  }
}

/**
 * List all shoppable links, optionally filtered by platform.
 */
export async function listShoppableLinks(filters?: {
  platform?: SocialPlatform;
  productId?: string;
  limit?: number;
}): Promise<ShoppableLink[]> {
  try {
    const where: Record<string, unknown> = {};
    if (filters?.platform) where.platform = filters.platform;
    if (filters?.productId) where.productId = filters.productId;

    const records = await prisma.shoppableLink.findMany({
      where,
      take: filters?.limit ?? 100,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r: {
      id: string;
      shortCode: string;
      fullUrl: string;
      productId: string;
      productName: string;
      platform: string;
      utmSource: string;
      utmMedium: string;
      utmCampaign: string;
      utmContent: string | null;
      clicks: number;
      conversions: number;
      revenue: unknown;
      createdAt: Date;
      expiresAt: Date | null;
    }) => ({
      id: r.id,
      shortCode: r.shortCode,
      fullUrl: r.fullUrl,
      productId: r.productId,
      productName: r.productName,
      platform: r.platform as SocialPlatform,
      utmSource: r.utmSource,
      utmMedium: r.utmMedium,
      utmCampaign: r.utmCampaign,
      utmContent: r.utmContent ?? undefined,
      clicks: r.clicks,
      conversions: r.conversions,
      revenue: Number(r.revenue),
      createdAt: r.createdAt,
      expiresAt: r.expiresAt ?? undefined,
    }));
  } catch {
    logger.warn('[ShoppableLinks] ShoppableLink model not yet available');
    return [];
  }
}

/**
 * Get aggregate analytics across all shoppable links.
 */
export async function getShoppableLinkStats(): Promise<{
  totalLinks: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  byPlatform: Record<string, { links: number; clicks: number; conversions: number; revenue: number }>;
}> {
  try {
    const links = await prisma.shoppableLink.findMany({
      take: 10_000,
      select: {
        platform: true,
        clicks: true,
        conversions: true,
        revenue: true,
      },
    });

    const byPlatform: Record<string, { links: number; clicks: number; conversions: number; revenue: number }> = {};

    let totalClicks = 0;
    let totalConversions = 0;
    let totalRevenue = 0;

    for (const link of links) {
      const p = link.platform;
      if (!byPlatform[p]) {
        byPlatform[p] = { links: 0, clicks: 0, conversions: 0, revenue: 0 };
      }
      byPlatform[p].links++;
      byPlatform[p].clicks += link.clicks;
      byPlatform[p].conversions += link.conversions;
      byPlatform[p].revenue += Number(link.revenue);

      totalClicks += link.clicks;
      totalConversions += link.conversions;
      totalRevenue += Number(link.revenue);
    }

    return {
      totalLinks: links.length,
      totalClicks,
      totalConversions,
      totalRevenue,
      byPlatform,
    };
  } catch {
    return {
      totalLinks: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      byPlatform: {},
    };
  }
}
