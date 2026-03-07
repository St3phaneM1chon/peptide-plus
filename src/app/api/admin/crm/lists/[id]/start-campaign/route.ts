export const dynamic = 'force-dynamic';

/**
 * 1-Click Campaign — Convert List → CrmLeads → DialerCampaign
 * POST /api/admin/crm/lists/[id]/start-campaign
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { createCampaignFromList } from '@/lib/crm/campaign-bridge';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

const campaignSchema = z.object({
  campaignName: z.string().min(1).max(200).trim(),
  companyId: z.string().cuid(),
  callerIdNumber: z.string().min(10).max(20),
  agentIds: z.array(z.string().cuid()).min(1),
  assignmentMethod: z.enum(['MANUAL', 'ROUND_ROBIN', 'LOAD_BALANCED', 'SCORE_BASED']).optional(),
  scriptTitle: z.string().max(200).optional(),
  scriptBody: z.string().max(10000).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().max(50).optional(),
  activeDays: z.array(z.string()).optional(),
  maxConcurrent: z.number().min(1).max(10).optional(),
  useAmd: z.boolean().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }>; session: { user: { id: string } } }) => {
  const { id: listId } = await context.params;
  const body = await request.json();
  const parsed = campaignSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  const result = await createCampaignFromList({
    listId,
    campaignName: parsed.data.campaignName,
    companyId: parsed.data.companyId,
    callerIdNumber: parsed.data.callerIdNumber,
    agentIds: parsed.data.agentIds,
    assignmentMethod: parsed.data.assignmentMethod || list.assignmentMethod,
    scriptTitle: parsed.data.scriptTitle,
    scriptBody: parsed.data.scriptBody,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    timezone: parsed.data.timezone,
    activeDays: parsed.data.activeDays,
    maxConcurrent: parsed.data.maxConcurrent,
    useAmd: parsed.data.useAmd,
  });

  logAdminAction({
    adminUserId: context.session.user.id,
    action: 'START_CAMPAIGN',
    targetType: 'ProspectList',
    targetId: listId,
    newValue: { campaignId: result.campaignId, campaignName: parsed.data.campaignName, leadsCreated: result.leadsCreated, entriesCreated: result.entriesCreated, dncFiltered: result.dncFiltered },
    ipAddress: getClientIpFromRequest(request),
  });

  return apiSuccess(result, { request });
});
