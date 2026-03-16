export const dynamic = 'force-dynamic';

/**
 * Integrate Prospect List into CRM
 * POST /api/admin/crm/lists/[id]/integrate
 *
 * Converts VALIDATED prospects into CrmLead with:
 *   - Multi-factor scoring (not just rating * 20)
 *   - Auto temperature assignment
 *   - BANT pre-fill
 *   - DNC pre-check
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { updateListCounters } from '@/lib/crm/prospect-dedup';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { calculateScore, generateBANT } from '@/lib/crm/lead-scoring';
import { phoneDncVariants } from '@/lib/crm/phone-utils';
import {
  assignLeadsBulkRoundRobin,
  assignLeadsLoadBalanced,
  assignLeadsScoreBased,
  assignLeadsManual,
} from '@/lib/crm/lead-assignment';
import { logger } from '@/lib/logger';

const integrateSchema = z.object({
  assignmentMethod: z.enum(['MANUAL', 'ROUND_ROBIN', 'LOAD_BALANCED', 'SCORE_BASED']).optional(),
  agentIds: z.array(z.string().cuid()).optional(),
  statusFilter: z.enum(['NEW', 'VALIDATED']).optional(),
  dncPreCheck: z.boolean().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }>; session: { user: { id: string } } }) => {
  const { id: listId } = await context.params;
  const body = await request.json();
  const parsed = integrateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, request });
  }

  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  const statusFilter = parsed.data.statusFilter || 'VALIDATED';
  const prospects = await prisma.prospect.findMany({
    where: { listId, status: statusFilter },
  });

  if (prospects.length === 0) {
    return apiError('No prospects to integrate', 'VALIDATION_ERROR', { status: 400, request });
  }

  let integrated = 0;
  let skipped = 0;
  let dncFiltered = 0;
  const createdLeadIds: string[] = [];
  const errors: { prospectId: string; reason: string }[] = [];

  // N+1 fix: Batch DNC pre-check — single query for all phone variants
  const dncBlockedPhones = new Set<string>();
  if (parsed.data.dncPreCheck !== false) {
    const allVariants: string[] = [];
    const variantToPhone = new Map<string, string>();
    for (const prospect of prospects) {
      if (prospect.phone) {
        const variants = phoneDncVariants(prospect.phone);
        for (const v of variants) {
          allVariants.push(v);
          variantToPhone.set(v, prospect.phone);
        }
      }
    }
    if (allVariants.length > 0) {
      const dncEntries = await prisma.dnclEntry.findMany({
        where: {
          phoneNumber: { in: allVariants },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { phoneNumber: true },
      });
      for (const entry of dncEntries) {
        const originalPhone = variantToPhone.get(entry.phoneNumber);
        if (originalPhone) dncBlockedPhones.add(originalPhone);
      }
    }
  }

  // Batch prospect updates for DNC-blocked and integrated prospects
  const dncUpdateIds: string[] = [];
  const leadsToCreate: Array<{ prospect: typeof prospects[0]; scoreBreakdown: ReturnType<typeof calculateScore>; bant: ReturnType<typeof generateBANT> }> = [];

  for (const prospect of prospects) {
    if (prospect.convertedLeadId) {
      skipped++;
      continue;
    }

    // DNC check using pre-fetched data
    if (prospect.phone && dncBlockedPhones.has(prospect.phone)) {
      dncUpdateIds.push(prospect.id);
      dncFiltered++;
      continue;
    }

    const scoreBreakdown = calculateScore(prospect as Parameters<typeof calculateScore>[0]);
    const bant = generateBANT(prospect as Parameters<typeof generateBANT>[0]);
    leadsToCreate.push({ prospect, scoreBreakdown, bant });
  }

  // Batch update DNC-blocked prospects in one transaction
  if (dncUpdateIds.length > 0) {
    await prisma.prospect.updateMany({
      where: { id: { in: dncUpdateIds } },
      data: { dncChecked: true, dncStatus: 'NATIONAL_DNC' },
    });
  }

  // N+1 fix: Batch create all leads + update all prospects in a single transaction
  // instead of individual create+update per prospect (was 2N queries, now 1 transaction)
  if (leadsToCreate.length > 0) {
    try {
      const txOps = leadsToCreate.flatMap(({ prospect, scoreBreakdown, bant }) => [
        prisma.crmLead.create({
          data: {
            contactName: prospect.contactName,
            companyName: prospect.companyName,
            email: prospect.email,
            phone: prospect.phone,
            source: 'IMPORT',
            status: 'NEW',
            score: scoreBreakdown.total,
            temperature: scoreBreakdown.temperature,
            customFields: prospect.customFields || undefined,
            qualificationFramework: 'BANT',
            qualificationData: bant as Record<string, string>,
            dncStatus: 'CALLABLE',
          },
        }),
      ]);

      const createdLeads = await prisma.$transaction(txOps);

      // Now batch-update all prospects with their lead IDs in a single transaction
      const prospectUpdateOps = leadsToCreate.map(({ prospect }, index) => {
        const lead = createdLeads[index];
        return prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            convertedLeadId: lead.id,
            status: 'INTEGRATED',
            dncChecked: true,
            dncStatus: 'CALLABLE',
          },
        });
      });

      await prisma.$transaction(prospectUpdateOps);

      for (const lead of createdLeads) {
        createdLeadIds.push(lead.id);
      }
      integrated = createdLeads.length;
    } catch (err) {
      logger.error('[CRM/Integrate] Bulk transaction failed, falling back to individual creates', { listId, error: err });
      // If bulk transaction fails, fall back to individual creates for error isolation
      for (const { prospect, scoreBreakdown, bant } of leadsToCreate) {
        try {
          const lead = await prisma.crmLead.create({
            data: {
              contactName: prospect.contactName,
              companyName: prospect.companyName,
              email: prospect.email,
              phone: prospect.phone,
              source: 'IMPORT',
              status: 'NEW',
              score: scoreBreakdown.total,
              temperature: scoreBreakdown.temperature,
              customFields: prospect.customFields || undefined,
              qualificationFramework: 'BANT',
              qualificationData: bant as Record<string, string>,
              dncStatus: 'CALLABLE',
            },
          });

          await prisma.prospect.update({
            where: { id: prospect.id },
            data: {
              convertedLeadId: lead.id,
              status: 'INTEGRATED',
              dncChecked: true,
              dncStatus: 'CALLABLE',
            },
          });

          createdLeadIds.push(lead.id);
          integrated++;
        } catch (individualErr) {
          logger.error('[CRM/Integrate] Individual lead create failed:', individualErr);
          errors.push({ prospectId: prospect.id, reason: individualErr instanceof Error ? individualErr.message : 'Unknown error' });
        }
      }
    }
  }

  // Apply assignment
  let assigned = 0;
  const method = parsed.data.assignmentMethod || list.assignmentMethod;
  const agentIds = parsed.data.agentIds || [];

  if (createdLeadIds.length > 0 && agentIds.length > 0) {
    let result;
    switch (method) {
      case 'ROUND_ROBIN': {
        const config = (list.assignmentConfig as { currentIndex?: number }) || {};
        result = await assignLeadsBulkRoundRobin(createdLeadIds, agentIds, config.currentIndex || 0);
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

  await prisma.prospectList.update({
    where: { id: listId },
    data: { status: 'INTEGRATED' },
  });
  await updateListCounters(listId);

  logAdminAction({
    adminUserId: context.session.user.id,
    action: 'INTEGRATE_PROSPECTS',
    targetType: 'ProspectList',
    targetId: listId,
    newValue: { integrated, skipped, dncFiltered, assigned, errorCount: errors.length },
    ipAddress: getClientIpFromRequest(request),
  });

  return apiSuccess({ integrated, skipped, dncFiltered, assigned, errors }, { request });
}, { requiredPermission: 'crm.leads.edit' });
