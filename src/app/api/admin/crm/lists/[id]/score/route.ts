export const dynamic = 'force-dynamic';

/**
 * Score & Auto-Qualify Prospects in List
 * POST /api/admin/crm/lists/[id]/score
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { scoreProspectList, autoQualifyList } from '@/lib/crm/lead-scoring';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

const scoreSchema = z.object({
  targetIndustries: z.array(z.string()).optional(),
  targetCompanySizes: z.array(z.string()).optional(),
  autoQualify: z.boolean().optional(),
  qualifyThreshold: z.number().min(0).max(100).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }>; session: { user: { id: string } } }) => {
  const { id: listId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = scoreSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  const scoreResult = await scoreProspectList(listId, {
    targetIndustries: parsed.data.targetIndustries,
    targetCompanySizes: parsed.data.targetCompanySizes,
  });

  let qualifyResult = null;
  if (parsed.data.autoQualify) {
    qualifyResult = await autoQualifyList(listId, parsed.data.qualifyThreshold || 50);
  }

  logAdminAction({
    adminUserId: context.session.user.id,
    action: 'SCORE_PROSPECTS',
    targetType: 'ProspectList',
    targetId: listId,
    newValue: { scored: scoreResult.scored, averageScore: scoreResult.averageScore, distribution: scoreResult.distribution, qualified: qualifyResult?.qualified },
    ipAddress: getClientIpFromRequest(request),
  });

  return apiSuccess({
    ...scoreResult,
    qualification: qualifyResult,
  }, { request });
});
