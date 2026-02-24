export const dynamic = 'force-dynamic';

// TODO: FAILLE-094 - SiteSettings create uses empty defaults; provide sensible initial values or show setup wizard
// TODO: FAILLE-095 - parseSafe returns 'unknown'; use generic type parameter for better type safety
// TODO: FAILLE-098 - Every GET re-fetches SiteSettings from DB; add in-memory cache with 30s TTL

/**
 * Admin Settings API
 * GET  - Retrieve all settings (SiteSettings singleton + SiteSetting key-value pairs)
 * PUT  - Update settings (SiteSettings fields and/or SiteSetting entries)
 *
 * Item 74: Feature Flags via SiteSetting key-value store
 * -------------------------------------------------------
 * Feature flags are managed as SiteSetting entries with module='feature_flags'.
 * This allows toggling features without code deployment.
 *
 * Convention:
 *   key:    "ff.<feature_name>"     (e.g., "ff.live_chat", "ff.ab_testing")
 *   value:  "true" | "false" | JSON (for richer config like rollout %)
 *   type:   "boolean" | "json"
 *   module: "feature_flags"
 *
 * Example: Enable live chat feature:
 *   PUT /api/admin/settings
 *   { "settings": [{ "key": "ff.live_chat", "value": "true", "type": "boolean", "module": "feature_flags" }] }
 *
 * Read flags in app code via:
 *   const setting = await prisma.siteSetting.findUnique({ where: { key: 'ff.live_chat' } });
 *   const isEnabled = setting?.value === 'true';
 *
 * TODO (item 74): Build a dedicated /api/feature-flags endpoint that:
 *   - GET returns all flags with their current state (public, cached 60s)
 *   - Supports percentage-based rollouts (value: { enabled: true, rollout: 25 })
 *   - Supports user segment targeting (e.g., only for loyaltyTier='GOLD')
 *   - Caches flags in-memory with revalidation to avoid DB hits per request
 *   - Provides a client-side React hook: useFeatureFlag('live_chat')
 *
 * TODO (item 85): A/B Testing Framework
 * Build an A/B testing system on top of feature flags:
 *   - Define experiments as SiteSetting entries with module='ab_tests'
 *   - Each experiment has: name, variants (with weights), targetMetric, startDate, endDate
 *   - Assign users to variants deterministically using hash(userId + experimentId) % 100
 *   - Track conversion events via a new AbTestEvent model
 *   - Provide an admin dashboard to view results with statistical significance
 *   - Auto-graduate winning variants after reaching significance threshold
 *   - Key routes to create: /api/admin/ab-tests (CRUD), /api/ab-tests/assign (variant assignment)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// FAILLE-026 FIX: Zod schema for PUT body validation
const settingsPutSchema = z.object({
  siteSettings: z.record(z.unknown()).optional(),
  settings: z.union([
    z.array(z.object({ key: z.string(), value: z.unknown(), type: z.string().optional(), module: z.string().optional(), description: z.string().nullish() })),
    z.record(z.unknown()),
  ]).optional(),
}).strict();

// Zod schema for PATCH body validation (single key-value update)
const settingsPatchSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid key format'),
  value: z.unknown(),
  type: z.string().optional(),
  module: z.string().optional(),
  description: z.string().nullish(),
}).strict();

// GET /api/admin/settings - Get all settings
export const GET = withAdminGuard(async (_request, { session: _session }) => {
  try {
    // Fetch the singleton SiteSettings (create default if not exists)
    let siteSettings = await prisma.siteSettings.findUnique({
      where: { id: 'default' },
    });

    if (!siteSettings) {
      siteSettings = await prisma.siteSettings.create({
        data: { id: 'default' },
      });
    }

    // FAILLE-040 FIX: Add take limit to prevent unbounded query
    const siteSettingEntries = await prisma.siteSetting.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
      take: 500,
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
      const mod = entry.module || 'general';
      if (!settingsByModule[mod]) {
        settingsByModule[mod] = [];
      }
      settingsByModule[mod].push({
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

    // FAILLE-041 FIX: Filter sensitive email fields for non-OWNER roles
    const filteredSiteSettings = { ...siteSettings };
    if (_session.user.role !== 'OWNER') {
      delete (filteredSiteSettings as Record<string, unknown>).legalEmail;
      delete (filteredSiteSettings as Record<string, unknown>).privacyEmail;
    }

    return NextResponse.json({
      siteSettings: {
        ...filteredSiteSettings,
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
    logger.error('Admin settings GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT /api/admin/settings - Update settings
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    // FAILLE-026 FIX: Validate PUT body with Zod
    const parsed = settingsPutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }
    const { siteSettings: siteSettingsData, settings: keyValueSettings } = parsed.data;

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
    // DI-67: Wrap all upserts in a transaction for atomicity
    if (keyValueSettings && typeof keyValueSettings === 'object') {
      const updatedKeys: string[] = [];

      await prisma.$transaction(async (tx) => {
        // keyValueSettings can be:
        // - An object { key: value } for simple updates
        // - An array of { key, value, type?, module?, description? } for detailed updates
        if (Array.isArray(keyValueSettings)) {
          for (const entry of keyValueSettings) {
            if (!entry.key || entry.value === undefined) continue;

            await tx.siteSetting.upsert({
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
            await tx.siteSetting.upsert({
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
      });

      results.updatedKeys = updatedKeys;
    }

    // Audit log for settings update (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_SETTINGS',
      targetType: 'SiteSettings',
      targetId: 'default',
      newValue: { updatedKeys: results.updatedKeys, hasSiteSettings: !!results.siteSettings },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    logger.error('Admin settings PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/settings - Partial update (single key-value)
// Some admin pages (ambassador config, etc.) use PATCH for partial updates
export const PATCH = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = settingsPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { key, value, type, module, description } = parsed.data;

    const result = await prisma.siteSetting.upsert({
      where: { key },
      update: {
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        ...(type && { type }),
        ...(module && { module }),
        ...(description !== undefined && { description }),
        updatedBy: session.user.id,
      },
      create: {
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        type: type || 'text',
        module: module || 'general',
        description: description || null,
        updatedBy: session.user.id,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'PATCH_SETTING',
      targetType: 'SiteSetting',
      targetId: key,
      newValue: { key, value: typeof value === 'string' ? value.substring(0, 200) : '(object)' },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

    return NextResponse.json({ success: true, setting: result });
  } catch (error) {
    logger.error('Admin settings PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
