export const dynamic = 'force-dynamic';

/**
 * Public Loyalty Config API (read-only, no auth required)
 * Returns loyalty configuration values for the rewards page.
 * FIX F-024: Public endpoint so rewards page can load config from API
 * instead of relying on hardcoded LOYALTY_CONFIG from context.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { LOYALTY_POINTS_CONFIG } from '@/lib/constants';

const LOYALTY_CONFIG_KEY = 'loyalty_config';

export async function GET() {
  try {
    // Try to load admin-configured values from SiteSetting
    const setting = await prisma.siteSetting.findUnique({
      where: { key: LOYALTY_CONFIG_KEY },
    });

    let config = {
      pointsPerDollar: LOYALTY_POINTS_CONFIG.pointsPerDollar,
      pointsValue: LOYALTY_POINTS_CONFIG.pointsValue,
      referralBonus: LOYALTY_POINTS_CONFIG.referralBonus,
      birthdayBonus: LOYALTY_POINTS_CONFIG.birthdayBonus,
      reviewBonus: LOYALTY_POINTS_CONFIG.reviewBonus,
    };

    if (setting) {
      try {
        const parsed = JSON.parse(setting.value);
        config = {
          pointsPerDollar: parsed.pointsPerDollar ?? config.pointsPerDollar,
          pointsValue: parsed.pointsValue ?? config.pointsValue,
          referralBonus: parsed.referralBonus ?? config.referralBonus,
          birthdayBonus: parsed.birthdayBonus ?? config.birthdayBonus,
          reviewBonus: parsed.reviewBonus ?? config.reviewBonus,
        };
      } catch (error) {
        console.error('[LoyaltyConfig] JSON parse of loyalty config failed, using defaults:', error);
      }
    } else {
      // Fallback: try SiteSettings.rewardTiers
      try {
        const siteSettings = await prisma.siteSettings.findUnique({
          where: { id: 'default' },
          select: { rewardTiers: true },
        });
        if (siteSettings?.rewardTiers) {
          const parsed = JSON.parse(siteSettings.rewardTiers);
          config = {
            pointsPerDollar: parsed.pointsPerDollar ?? config.pointsPerDollar,
            pointsValue: parsed.pointsValue ?? config.pointsValue,
            referralBonus: parsed.referralBonus ?? config.referralBonus,
            birthdayBonus: parsed.birthdayBonus ?? config.birthdayBonus,
            reviewBonus: parsed.reviewBonus ?? config.reviewBonus,
          };
        }
      } catch (error) {
        console.error('[LoyaltyConfig] SiteSettings rewardTiers parse failed, using defaults:', error);
      }
    }

    return NextResponse.json({ config });
  } catch (error) {
    logger.error('Public loyalty config GET error', { error: error instanceof Error ? error.message : String(error) });
    // On error, return hardcoded defaults so the page still works
    return NextResponse.json({
      config: {
        pointsPerDollar: LOYALTY_POINTS_CONFIG.pointsPerDollar,
        pointsValue: LOYALTY_POINTS_CONFIG.pointsValue,
        referralBonus: LOYALTY_POINTS_CONFIG.referralBonus,
        birthdayBonus: LOYALTY_POINTS_CONFIG.birthdayBonus,
        reviewBonus: LOYALTY_POINTS_CONFIG.reviewBonus,
      },
    });
  }
}
