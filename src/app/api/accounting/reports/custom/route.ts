export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-handler';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const filterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
  value: z.union([z.string(), z.number(), z.array(z.string()), z.array(z.number())]),
});

const orderBySchema = z.object({
  field: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
});

const reportConfigSchema = z.object({
  type: z.enum([
    'INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW', 'AR_AGING', 'AP_AGING',
    'TAX_SUMMARY', 'JOURNAL_DETAIL', 'TRIAL_BALANCE', 'CUSTOM',
  ]),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  columns: z.array(z.string()).min(1),
  filters: z.array(filterSchema).default([]),
  groupBy: z.array(z.string()).optional(),
  orderBy: z.array(orderBySchema).optional(),
  compareWith: z.enum(['previous_period', 'previous_year', 'budget']).optional(),
  showTotals: z.boolean().optional(),
  showPercentages: z.boolean().optional(),
});

const createReportSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum([
    'INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW', 'AR_AGING', 'AP_AGING',
    'TAX_SUMMARY', 'JOURNAL_DETAIL', 'TRIAL_BALANCE', 'CUSTOM',
  ]),
  config: reportConfigSchema,
  isTemplate: z.boolean().optional().default(false),
  isPublic: z.boolean().optional().default(false),
  schedule: z.string().max(100).optional().nullable(),
  recipients: z.array(z.string().email()).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/reports/custom
// List saved reports (user's own + public templates)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const type = searchParams.get('type');
    const templatesOnly = searchParams.get('templates') === 'true';

    const where: Record<string, unknown> = { deletedAt: null };
    if (type) where.type = type;
    if (templatesOnly) where.isTemplate = true;

    const [reports, total] = await Promise.all([
      prisma.customReport.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          config: true,
          isTemplate: true,
          isPublic: true,
          createdBy: true,
          schedule: true,
          recipients: true,
          lastRunAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.customReport.count({ where }),
    ]);

    const mapped = reports.map((r) => ({
      ...r,
      config: safeParseJSON(r.config),
      recipients: r.recipients ? safeParseJSON(r.recipients) : null,
    }));

    return apiSuccess({
      reports: mapped,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('List custom reports error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to list custom reports', 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/reports/custom
// Save a new report configuration
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid report data', 400, parsed.error.errors);
    }

    const { name, description, type, config, isTemplate, isPublic, schedule, recipients } = parsed.data;

    const report = await prisma.customReport.create({
      data: {
        name,
        description: description || null,
        type,
        config: JSON.stringify(config),
        isTemplate: isTemplate ?? false,
        isPublic: isPublic ?? false,
        schedule: schedule || null,
        recipients: recipients ? JSON.stringify(recipients) : null,
      },
    });

    logger.info('Custom report created', { reportId: report.id, name, type });

    return apiSuccess({
      ...report,
      config: safeParseJSON(report.config),
      recipients: report.recipients ? safeParseJSON(report.recipients) : null,
    }, 201);
  } catch (error) {
    logger.error('Create custom report error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to create custom report', 500);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
