export const dynamic = 'force-dynamic';

/**
 * Enrich Prospects in List — Waterfall Email Enrichment
 * POST /api/admin/crm/lists/[id]/enrich
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { enrichProspectList } from '@/lib/crm/enrichment-pipeline';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

const enrichSchema = z.object({
  maxConcurrent: z.number().min(1).max(10).optional(),
  statusFilter: z.enum(['NEW', 'VALIDATED']).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }>; session: { user: { id: string } } }) => {
  const { id: listId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = enrichSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  const result = await enrichProspectList(listId, {
    maxConcurrent: parsed.data.maxConcurrent,
    statusFilter: parsed.data.statusFilter,
  });

  logAdminAction({
    adminUserId: context.session.user.id,
    action: 'ENRICH_PROSPECTS',
    targetType: 'ProspectList',
    targetId: listId,
    newValue: { total: result.total, enriched: result.enriched, emailsFound: result.emailsFound, errors: result.errors },
    ipAddress: getClientIpFromRequest(request),
  });

  return apiSuccess(result, { request });
});
