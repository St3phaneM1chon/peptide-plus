export const dynamic = 'force-dynamic';

/**
 * Dashboard Builder API (J13)
 * GET  /api/admin/crm/dashboard-builder - List saved dashboards
 * POST /api/admin/crm/dashboard-builder - Save/update a dashboard config
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ErrorCode } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const widgetSchema = z.object({
  id: z.string(),
  type: z.enum(['kpi', 'bar', 'line', 'pie', 'table', 'metric']),
  title: z.string().min(1).max(100),
  dataSource: z.string().min(1).max(255),
  refreshInterval: z.number().int().min(0).max(3600).default(60),
  position: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  config: z.record(z.unknown()).optional(),
});

const saveDashboardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  widgets: z.array(widgetSchema),
  isDefault: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// GET: List saved dashboards (stored in SiteSetting with module "crm_dashboard")
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { module: 'crm_dashboard' },
      orderBy: { updatedAt: 'desc' },
    });

    const dashboards = settings.map(s => {
      const config = JSON.parse(s.value || '{}');
      return {
        id: s.id,
        key: s.key,
        name: config?.name || s.key,
        description: config?.description || s.description || '',
        widgetCount: config?.widgets?.length || 0,
        isDefault: config?.isDefault || false,
        updatedAt: s.updatedAt,
      };
    });

    return apiSuccess(dashboards, { request });
  } catch (error) {
    logger.error('[crm/dashboard-builder] GET error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch dashboards', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.settings', skipCsrf: true });

// ---------------------------------------------------------------------------
// POST: Save/update a dashboard configuration
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { session }: { session: { user: { id: string } } }
) => {
  try {
    const body = await request.json();
    const parsed = saveDashboardSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid dashboard config', ErrorCode.VALIDATION_ERROR, {
        request, status: 400, details: parsed.error.flatten(),
      });
    }

    const { name, description, widgets, isDefault } = parsed.data;
    const key = `crm_dash_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const value = JSON.stringify({ name, description, widgets, isDefault });

    const saved = await prisma.siteSetting.upsert({
      where: { key },
      update: { value, description: description || null, updatedBy: session.user.id },
      create: {
        key,
        value,
        type: 'json',
        module: 'crm_dashboard',
        description: description || null,
        updatedBy: session.user.id,
      },
    });

    logger.info('[crm/dashboard-builder] Dashboard saved', { key, userId: session.user.id });
    return apiSuccess({ id: saved.id, key, name }, { request, status: 201 });
  } catch (error) {
    logger.error('[crm/dashboard-builder] POST error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to save dashboard', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.settings' });
