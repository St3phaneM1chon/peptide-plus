export const dynamic = 'force-dynamic';

/**
 * Admin Settings API
 * GET  - Retrieve all settings (SiteSettings singleton + SiteSetting key-value pairs)
 * PUT  - Update settings (SiteSettings fields and/or SiteSetting entries)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

// GET /api/admin/settings - Get all settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the singleton SiteSettings (create default if not exists)
    let siteSettings = await prisma.siteSettings.findUnique({
      where: { id: 'default' },
    });

    if (!siteSettings) {
      siteSettings = await prisma.siteSettings.create({
        data: { id: 'default' },
      });
    }

    // Fetch all key-value SiteSetting entries
    const siteSettingEntries = await prisma.siteSetting.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    });

    // Group SiteSetting entries by module
    const settingsByModule: Record<string, Array<{
      id: string;
      key: string;
      value: string;
      type: string;
      description: string | null;
      updatedAt: Date;
    }>> = {};

    for (const entry of siteSettingEntries) {
      const module = entry.module || 'general';
      if (!settingsByModule[module]) {
        settingsByModule[module] = [];
      }
      settingsByModule[module].push({
        id: entry.id,
        key: entry.key,
        value: entry.value,
        type: entry.type,
        description: entry.description,
        updatedAt: entry.updatedAt,
      });
    }

    // Parse JSON fields from SiteSettings
    const parseSafe = (val: string | null): unknown => {
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    };

    return NextResponse.json({
      siteSettings: {
        ...siteSettings,
        freeShippingThreshold: siteSettings.freeShippingThreshold
          ? Number(siteSettings.freeShippingThreshold)
          : null,
        businessHours: parseSafe(siteSettings.businessHours),
        socialLinks: parseSafe(siteSettings.socialLinks),
        trustBadges: parseSafe(siteSettings.trustBadges),
        headerNav: parseSafe(siteSettings.headerNav),
        footerNav: parseSafe(siteSettings.footerNav),
        shippingRates: parseSafe(siteSettings.shippingRates),
        ambassadorTiers: parseSafe(siteSettings.ambassadorTiers),
        rewardTiers: parseSafe(siteSettings.rewardTiers),
        subscriptionFreqs: parseSafe(siteSettings.subscriptionFreqs),
        testimonials: parseSafe(siteSettings.testimonials),
        statsJson: parseSafe(siteSettings.statsJson),
      },
      settings: settingsByModule,
    });
  } catch (error) {
    console.error('Admin settings GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/settings - Update settings
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteSettings: siteSettingsData, settings: keyValueSettings } = body;

    const results: { siteSettings?: unknown; updatedKeys?: string[] } = {};

    // Update SiteSettings singleton
    if (siteSettingsData && typeof siteSettingsData === 'object') {
      // List of allowed fields for SiteSettings
      const allowedFields = [
        'companyName', 'companyLegalName', 'companyDescription', 'logoUrl',
        'email', 'supportEmail', 'legalEmail', 'privacyEmail',
        'phone', 'address', 'city', 'province', 'postalCode', 'country',
        'businessHours', 'socialLinks',
        'freeShippingThreshold', 'defaultCurrency',
        'newsletterEnabled', 'newsletterTitle', 'newsletterSubtitle',
        'newsletterDiscount', 'newsletterPromoCode',
        'disclaimerEnabled', 'disclaimerTitle', 'disclaimerContent', 'disclaimerAgeMin',
        'cookieBannerText', 'trustBadges', 'headerNav', 'footerNav',
        'shippingRates', 'refundDays', 'refundProcessingDays',
        'ambassadorTiers', 'rewardTiers', 'subscriptionFreqs',
        'testimonials', 'statsJson',
      ];

      const updateData: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (field in siteSettingsData) {
          let value = siteSettingsData[field];

          // Convert objects/arrays to JSON strings for Text fields
          const jsonFields = [
            'businessHours', 'socialLinks', 'trustBadges', 'headerNav', 'footerNav',
            'shippingRates', 'ambassadorTiers', 'rewardTiers', 'subscriptionFreqs',
            'testimonials', 'statsJson',
          ];

          if (jsonFields.includes(field) && typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }

          updateData[field] = value;
        }
      }

      if (Object.keys(updateData).length > 0) {
        results.siteSettings = await prisma.siteSettings.upsert({
          where: { id: 'default' },
          update: updateData,
          create: { id: 'default', ...updateData },
        });
      }
    }

    // Update key-value SiteSetting entries
    if (keyValueSettings && typeof keyValueSettings === 'object') {
      const updatedKeys: string[] = [];

      // keyValueSettings can be:
      // - An object { key: value } for simple updates
      // - An array of { key, value, type?, module?, description? } for detailed updates
      if (Array.isArray(keyValueSettings)) {
        for (const entry of keyValueSettings) {
          if (!entry.key || entry.value === undefined) continue;

          await prisma.siteSetting.upsert({
            where: { key: entry.key },
            update: {
              value: String(entry.value),
              ...(entry.type && { type: entry.type }),
              ...(entry.module && { module: entry.module }),
              ...(entry.description !== undefined && { description: entry.description }),
              updatedBy: session.user.id,
            },
            create: {
              key: entry.key,
              value: String(entry.value),
              type: entry.type || 'text',
              module: entry.module || 'general',
              description: entry.description || null,
              updatedBy: session.user.id,
            },
          });

          updatedKeys.push(entry.key);
        }
      } else {
        // Simple object format: { "key1": "value1", "key2": "value2" }
        for (const [key, value] of Object.entries(keyValueSettings)) {
          await prisma.siteSetting.upsert({
            where: { key },
            update: {
              value: String(value),
              updatedBy: session.user.id,
            },
            create: {
              key,
              value: String(value),
              updatedBy: session.user.id,
            },
          });

          updatedKeys.push(key);
        }
      }

      results.updatedKeys = updatedKeys;
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Admin settings PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
