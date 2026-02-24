export const dynamic = 'force-dynamic';

/**
 * Admin Loyalty Config API
 * GET - Get loyalty configuration (point values, tier thresholds, bonus rules)
 * PUT - Save loyalty configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { updateLoyaltyConfigSchema } from '@/lib/validations/loyalty';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { LOYALTY_POINTS_CONFIG, LOYALTY_TIER_THRESHOLDS } from '@/lib/constants';
import { logger } from '@/lib/logger';

interface LoyaltyTier {
  name: string;
  minPoints: number;
  multiplier: number;
  perks: string[];
  color: string;
}

interface LoyaltyConfig {
  pointsPerDollar: number;
  pointsValue: number;
  minRedemption: number;
  referralBonus: number;
  birthdayBonus: number;
  tiers: LoyaltyTier[];
}

// Default config derived from CANONICAL constants in @/lib/constants.ts
const DEFAULT_CONFIG: LoyaltyConfig = {
  pointsPerDollar: LOYALTY_POINTS_CONFIG.pointsPerDollar,
  pointsValue: LOYALTY_POINTS_CONFIG.pointsValue,
  minRedemption: 500,
  referralBonus: LOYALTY_POINTS_CONFIG.referralBonus,
  birthdayBonus: LOYALTY_POINTS_CONFIG.birthdayBonus,
  tiers: LOYALTY_TIER_THRESHOLDS.map(tier => ({
    name: tier.name,
    minPoints: tier.minPoints,
    multiplier: tier.multiplier,
    perks: [`${tier.multiplier * LOYALTY_POINTS_CONFIG.pointsPerDollar} pts/$`],
    color: tier.color,
  })),
};

const LOYALTY_CONFIG_KEY = 'loyalty_config';

// GET /api/admin/loyalty/config
export const GET = withAdminGuard(async (_request, _ctx) => {
  try {
    // Try to load from SiteSetting key-value store
    const setting = await prisma.siteSetting.findUnique({
      where: { key: LOYALTY_CONFIG_KEY },
    });

    let config: LoyaltyConfig;

    if (setting) {
      try {
        config = JSON.parse(setting.value) as LoyaltyConfig;
      } catch (error) {
        logger.error('[LoyaltyConfig] Failed to parse loyalty config JSON from SiteSetting', { error: error instanceof Error ? error.message : String(error) });
        config = DEFAULT_CONFIG;
      }
    } else {
      // Also try the rewardTiers field from SiteSettings
      const siteSettings = await prisma.siteSettings.findUnique({
        where: { id: 'default' },
        select: { rewardTiers: true },
      });

      if (siteSettings?.rewardTiers) {
        try {
          const parsed = JSON.parse(siteSettings.rewardTiers);
          config = {
            pointsPerDollar: parsed.pointsPerDollar ?? DEFAULT_CONFIG.pointsPerDollar,
            pointsValue: parsed.pointsValue ?? DEFAULT_CONFIG.pointsValue,
            minRedemption: parsed.minRedemption ?? DEFAULT_CONFIG.minRedemption,
            referralBonus: parsed.referralBonus ?? DEFAULT_CONFIG.referralBonus,
            birthdayBonus: parsed.birthdayBonus ?? DEFAULT_CONFIG.birthdayBonus,
            tiers: parsed.tiers ?? DEFAULT_CONFIG.tiers,
          };
        } catch (error) {
          logger.error('[LoyaltyConfig] Failed to parse rewardTiers JSON from SiteSettings', { error: error instanceof Error ? error.message : String(error) });
          config = DEFAULT_CONFIG;
        }
      } else {
        config = DEFAULT_CONFIG;
      }
    }

    return NextResponse.json({ config });
  } catch (error) {
    logger.error('Admin loyalty config GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT /api/admin/loyalty/config
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = updateLoyaltyConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const config: LoyaltyConfig = parsed.data;

    // Save to SiteSetting (key-value)
    const configJson = JSON.stringify(config);

    await prisma.siteSetting.upsert({
      where: { key: LOYALTY_CONFIG_KEY },
      update: {
        value: configJson,
        updatedBy: session.user.id,
      },
      create: {
        key: LOYALTY_CONFIG_KEY,
        value: configJson,
        type: 'json',
        module: 'loyalty',
        description: 'Loyalty program configuration (tiers, points, bonuses)',
        updatedBy: session.user.id,
      },
    });

    // Also sync tiers to SiteSettings.rewardTiers for consistency
    try {
      await prisma.siteSettings.upsert({
        where: { id: 'default' },
        update: { rewardTiers: configJson },
        create: {
          id: 'default',
          rewardTiers: configJson,
        },
      });
    } catch (syncErr) {
      // Non-critical: SiteSettings sync is optional, but log for diagnostics
      logger.error('Non-critical: SiteSettings rewardTiers sync failed', { error: syncErr instanceof Error ? syncErr.message : String(syncErr) });
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_LOYALTY_CONFIG',
      targetType: 'SiteSetting',
      targetId: LOYALTY_CONFIG_KEY,
      newValue: { pointsPerDollar: config.pointsPerDollar, pointsValue: config.pointsValue, tierCount: config.tiers.length },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => logger.error('Audit log failed for UPDATE_LOYALTY_CONFIG', { error: err instanceof Error ? err.message : String(err) }));

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    logger.error('Admin loyalty config PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
