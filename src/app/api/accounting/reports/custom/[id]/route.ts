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

const updateReportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum([
    'INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW', 'AR_AGING', 'AP_AGING',
    'TAX_SUMMARY', 'JOURNAL_DETAIL', 'TRIAL_BALANCE', 'CUSTOM',
  ]).optional(),
  config: reportConfigSchema.optional(),
  isTemplate: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  schedule: z.string().max(100).optional().nullable(),
  recipients: z.array(z.string().email()).optional().nullable(),
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

function extractId(request: Request): string | null {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  // /api/accounting/reports/custom/[id] -> id is after "custom"
  const customIdx = segments.indexOf('custom');
  if (customIdx >= 0 && customIdx + 1 < segments.length) {
    return segments[customIdx + 1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/accounting/reports/custom/[id]
// Get a single report config
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const id = extractId(request);
    if (!id) return apiError('Report ID is required', 400);

    const report = await prisma.customReport.findFirst({
      where: { id, deletedAt: null },
    });

    if (!report) {
      return apiError('Report not found', 404);
    }

    return apiSuccess({
      ...report,
      config: safeParseJSON(report.config),
      recipients: report.recipients ? safeParseJSON(report.recipients) : null,
      lastRunData: report.lastRunData ? safeParseJSON(report.lastRunData) : null,
    });
  } catch (error) {
    logger.error('Get custom report error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to get custom report', 500);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/reports/custom/[id]
// Update report config
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request) => {
  try {
    const id = extractId(request);
    if (!id) return apiError('Report ID is required', 400);

    const existing = await prisma.customReport.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return apiError('Report not found', 404);
    }

    const body = await request.json();
    const parsed = updateReportSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid report data', 400, parsed.error.errors);
    }

    const { name, description, type, config, isTemplate, isPublic, schedule, recipients } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (config !== undefined) updateData.config = JSON.stringify(config);
    if (isTemplate !== undefined) updateData.isTemplate = isTemplate;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (recipients !== undefined) updateData.recipients = recipients ? JSON.stringify(recipients) : null;

    const report = await prisma.customReport.update({
      where: { id },
      data: updateData,
    });

    logger.info('Custom report updated', { reportId: id });

    return apiSuccess({
      ...report,
      config: safeParseJSON(report.config),
      recipients: report.recipients ? safeParseJSON(report.recipients) : null,
    });
  } catch (error) {
    logger.error('Update custom report error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to update custom report', 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/reports/custom/[id]
// Soft delete a report
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request) => {
  try {
    const id = extractId(request);
    if (!id) return apiError('Report ID is required', 400);

    const existing = await prisma.customReport.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return apiError('Report not found', 404);
    }

    await prisma.customReport.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Custom report soft-deleted', { reportId: id });

    return apiSuccess({ message: 'Report deleted' });
  } catch (error) {
    logger.error('Delete custom report error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to delete custom report', 500);
  }
});
