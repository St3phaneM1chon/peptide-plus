export const dynamic = 'force-dynamic';

/**
 * Admin Loyalty Config API
 * GET - Get loyalty configuration (point values, tier thresholds, bonus rules)
 * PUT - Save loyalty configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

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

const DEFAULT_CONFIG: LoyaltyConfig = {
  pointsPerDollar: 10,
  pointsValue: 0.01,
  minRedemption: 500,
  referralBonus: 500,
  birthdayBonus: 200,
  tiers: [
    {
      name: 'Bronze',
      minPoints: 0,
      multiplier: 1,
      perks: ['10 pts/$', 'Free shipping over $100'],
      color: 'orange',
    },
    {
      name: 'Silver',
      minPoints: 1000,
      multiplier: 1.25,
      perks: ['12.5 pts/$', 'Free shipping over $75', '5% off accessories'],
      color: 'gray',
    },
    {
      name: 'Gold',
      minPoints: 5000,
      multiplier: 1.5,
      perks: ['15 pts/$', 'Free shipping', '10% off accessories', 'Early access'],
      color: 'yellow',
    },
    {
      name: 'Platinum',
      minPoints: 15000,
      multiplier: 2,
      perks: ['20 pts/$', 'Free shipping', '15% off everything', 'Priority support', 'Early access'],
      color: 'blue',
    },
    {
      name: 'Diamond',
      minPoints: 50000,
      multiplier: 3,
      perks: ['30 pts/$', 'Free express shipping', '20% off everything', 'Dedicated support', 'Exclusive products'],
      color: 'purple',
    },
  ],
};

const LOYALTY_CONFIG_KEY = 'loyalty_config';

// GET /api/admin/loyalty/config
export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    // Try to load from SiteSetting key-value store
    const setting = await prisma.siteSetting.findUnique({
      where: { key: LOYALTY_CONFIG_KEY },
    });

    let config: LoyaltyConfig;

    if (setting) {
      try {
        config = JSON.parse(setting.value) as LoyaltyConfig;
      } catch {
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
        } catch {
          config = DEFAULT_CONFIG;
        }
      } else {
        config = DEFAULT_CONFIG;
      }
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Admin loyalty config GET error:', error);
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

    // Validate required fields
    const config: LoyaltyConfig = {
      pointsPerDollar: Number(body.pointsPerDollar) || DEFAULT_CONFIG.pointsPerDollar,
      pointsValue: Number(body.pointsValue) || DEFAULT_CONFIG.pointsValue,
      minRedemption: Number(body.minRedemption) || DEFAULT_CONFIG.minRedemption,
      referralBonus: Number(body.referralBonus) || DEFAULT_CONFIG.referralBonus,
      birthdayBonus: Number(body.birthdayBonus) || DEFAULT_CONFIG.birthdayBonus,
      tiers: Array.isArray(body.tiers) ? body.tiers : DEFAULT_CONFIG.tiers,
    };

    // Validate tiers
    if (config.tiers.length === 0) {
      return NextResponse.json(
        { error: 'At least one tier is required' },
        { status: 400 }
      );
    }

    for (const tier of config.tiers) {
      if (!tier.name || tier.minPoints === undefined || tier.multiplier === undefined) {
        return NextResponse.json(
          { error: 'Each tier must have name, minPoints, and multiplier' },
          { status: 400 }
        );
      }
    }

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
    } catch {
      // Non-critical: SiteSettings sync is optional
    }

    return NextResponse.json({ config, success: true });
  } catch (error) {
    console.error('Admin loyalty config PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
