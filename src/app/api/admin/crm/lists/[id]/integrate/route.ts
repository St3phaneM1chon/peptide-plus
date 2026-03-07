export const dynamic = 'force-dynamic';

/**
 * Integrate Prospect List into CRM
 * POST /api/admin/crm/lists/[id]/integrate
 *
 * Converts VALIDATED prospects into CrmLead, applies assignment method.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { updateListCounters } from '@/lib/crm/prospect-dedup';
import {
  assignLeadsBulkRoundRobin,
  assignLeadsLoadBalanced,
  assignLeadsScoreBased,
  assignLeadsManual,
} from '@/lib/crm/lead-assignment';

const integrateSchema = z.object({
  assignmentMethod: z.enum(['MANUAL', 'ROUND_ROBIN', 'LOAD_BALANCED', 'SCORE_BASED']).optional(),
  agentIds: z.array(z.string().cuid()).optional(),
  statusFilter: z.enum(['NEW', 'VALIDATED']).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: listId } = await context.params;
  const body = await request.json();
  const parsed = integrateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  // Get prospects to integrate
  const statusFilter = parsed.data.statusFilter || 'VALIDATED';
  const prospects = await prisma.prospect.findMany({
    where: { listId, status: statusFilter },
  });

  if (prospects.length === 0) {
    return apiError('No prospects to integrate', 'VALIDATION_ERROR', { status: 400, request });
  }

  let integrated = 0;
  let skipped = 0;
  const createdLeadIds: string[] = [];
  const errors: { prospectId: string; reason: string }[] = [];

  for (const prospect of prospects) {
    try {
      // Check if already converted
      if (prospect.convertedLeadId) {
        skipped++;
        continue;
      }

      // Create CrmLead from prospect
      const lead = await prisma.crmLead.create({
        data: {
          contactName: prospect.contactName,
          companyName: prospect.companyName,
          email: prospect.email,
          phone: prospect.phone,
          source: 'IMPORT',
          status: 'NEW',
          score: prospect.googleRating ? Math.round(prospect.googleRating * 20) : 0,
          temperature: 'COLD',
          customFields: prospect.customFields ? JSON.parse(JSON.stringify(prospect.customFields)) : undefined,
        },
      });

      // Link prospect to lead
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { convertedLeadId: lead.id, status: 'INTEGRATED' },
      });

      createdLeadIds.push(lead.id);
      integrated++;
    } catch (err) {
      errors.push({ prospectId: prospect.id, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  // Apply assignment if agents provided
  let assigned = 0;
  const method = parsed.data.assignmentMethod || list.assignmentMethod;
  const agentIds = parsed.data.agentIds || [];

  if (createdLeadIds.length > 0 && agentIds.length > 0) {
    let result;
    switch (method) {
      case 'ROUND_ROBIN': {
        const config = (list.assignmentConfig as { currentIndex?: number }) || {};
        result = await assignLeadsBulkRoundRobin(createdLeadIds, agentIds, config.currentIndex || 0);
        // Save next index
        await prisma.prospectList.update({
          where: { id: listId },
          data: { assignmentConfig: { ...(list.assignmentConfig as object || {}), currentIndex: result.nextIndex } },
        });
        break;
      }
      case 'LOAD_BALANCED':
        result = await assignLeadsLoadBalanced(createdLeadIds, agentIds);
        break;
      case 'SCORE_BASED':
        result = await assignLeadsScoreBased(createdLeadIds, agentIds);
        break;
      case 'MANUAL':
        if (agentIds.length === 1) {
          result = await assignLeadsManual(createdLeadIds, agentIds[0]);
        }
        break;
    }
    assigned = result?.assigned || 0;
  }

  // Update list status
  await prisma.prospectList.update({
    where: { id: listId },
    data: { status: 'INTEGRATED' },
  });
  await updateListCounters(listId);

  return apiSuccess({ integrated, skipped, assigned, errors }, { request });
});
