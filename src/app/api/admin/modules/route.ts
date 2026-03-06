export const dynamic = 'force-dynamic';

/**
 * Module Feature Flags API
 * GET  /api/admin/modules — list all module flags
 * PUT  /api/admin/modules — update module flags
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import type { ModuleKey } from '@/lib/module-flags';

const ALL_MODULES: { key: ModuleKey; labelKey: string; description: string }[] = [
  { key: 'ecommerce', labelKey: 'admin.modules.ecommerce', description: 'Orders, customers, inventory, suppliers' },
  { key: 'crm', labelKey: 'admin.modules.crm', description: 'Deals, leads, pipeline, quotes, contracts' },
  { key: 'accounting', labelKey: 'admin.modules.accounting', description: 'Journal entries, invoices, reports' },
  { key: 'voip', labelKey: 'admin.modules.voip', description: 'Call logs, recordings, IVR, campaigns' },
  { key: 'email', labelKey: 'admin.modules.email', description: 'Inbox, campaigns, flows, templates' },
  { key: 'marketing', labelKey: 'admin.modules.marketing', description: 'Promo codes, promotions, banners' },
  { key: 'loyalty', labelKey: 'admin.modules.loyalty', description: 'Points, tiers, referrals, webinars' },
  { key: 'media', labelKey: 'admin.modules.media', description: 'Videos, social posts, content hub' },
  { key: 'community', labelKey: 'admin.modules.community', description: 'Reviews, forum, chat, ambassadors' },
  { key: 'catalog', labelKey: 'admin.modules.catalog', description: 'Products, categories, pricing' },
];

export const GET = withAdminGuard(async (
  request: NextRequest,
) => {
  try {
    const keys = ALL_MODULES.map((m) => `ff.${m.key}_module`);
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const valueMap = new Map(settings.map((s) => [s.key, s.value]));

    const modules = ALL_MODULES.map((m) => ({
      key: m.key,
      labelKey: m.labelKey,
      description: m.description,
      enabled: valueMap.get(`ff.${m.key}_module`) !== 'false',
    }));

    return apiSuccess({ modules }, { request });
  } catch (error) {
    logger.error('[modules] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch module flags', ErrorCode.INTERNAL_ERROR, { request });
  }
});

export const PUT = withAdminGuard(async (
  request: NextRequest,
) => {
  try {
    const body = await request.json();
    const { modules } = body as { modules: { key: ModuleKey; enabled: boolean }[] };

    if (!Array.isArray(modules)) {
      return apiError('modules must be an array', ErrorCode.VALIDATION_ERROR, { request });
    }

    const validKeys = new Set(ALL_MODULES.map((m) => m.key));

    // Upsert each flag
    const ops = modules
      .filter((m) => validKeys.has(m.key))
      .map((m) =>
        prisma.siteSetting.upsert({
          where: { key: `ff.${m.key}_module` },
          update: { value: m.enabled ? 'true' : 'false' },
          create: { key: `ff.${m.key}_module`, value: m.enabled ? 'true' : 'false' },
        })
      );

    await prisma.$transaction(ops);

    logger.info('[modules] Feature flags updated', {
      changes: modules.map((m) => `${m.key}=${m.enabled}`).join(', '),
    });

    return apiSuccess({ updated: modules.length }, { request });
  } catch (error) {
    logger.error('[modules] PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to update module flags', ErrorCode.INTERNAL_ERROR, { request });
  }
});
