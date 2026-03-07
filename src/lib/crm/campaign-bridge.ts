/**
 * Campaign Bridge — 1-click Prospect List → Dialer Campaign
 *
 * Converts VALIDATED prospects → CrmLeads → DialerListEntries
 * with DNC pre-check and automatic assignment.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { updateListCounters } from './prospect-dedup';
import { generateBANT } from './lead-scoring';
import { phoneDncVariants, toE164 } from './phone-utils';
import {
  assignLeadsBulkRoundRobin,
  assignLeadsLoadBalanced,
  assignLeadsScoreBased,
  assignLeadsManual,
} from './lead-assignment';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CampaignBridgeOptions {
  listId: string;
  campaignName: string;
  companyId: string;
  callerIdNumber: string;
  agentIds: string[];
  assignmentMethod: string;
  scriptTitle?: string;
  scriptBody?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  activeDays?: string[];
  maxConcurrent?: number;
  useAmd?: boolean;
}

export interface CampaignBridgeResult {
  campaignId: string;
  leadsCreated: number;
  entriesCreated: number;
  dncFiltered: number;
  assigned: number;
  errors: { prospectId: string; reason: string }[];
}

// ---------------------------------------------------------------------------
// DNC Check
// ---------------------------------------------------------------------------

async function checkDnc(phone: string): Promise<boolean> {
  if (!phone) return false;
  const variants = phoneDncVariants(phone);
  if (variants.length === 0) return false;

  const entry = await prisma.dnclEntry.findFirst({
    where: {
      phoneNumber: { in: variants },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  return !!entry;
}

// ---------------------------------------------------------------------------
// Main Bridge: List → Campaign
// ---------------------------------------------------------------------------

export async function createCampaignFromList(options: CampaignBridgeOptions): Promise<CampaignBridgeResult> {
  const { listId, campaignName, companyId, callerIdNumber, agentIds, assignmentMethod } = options;

  // 1. Get VALIDATED prospects with phone
  const prospects = await prisma.prospect.findMany({
    where: {
      listId,
      status: 'VALIDATED',
      phone: { not: null },
    },
  });

  if (prospects.length === 0) {
    throw new Error('No validated prospects with phone numbers found');
  }

  const createdLeadIds: string[] = [];
  const errors: { prospectId: string; reason: string }[] = [];
  let dncFiltered = 0;

  // 2. Convert each prospect to CrmLead (if not already done)
  for (const prospect of prospects) {
    try {
      // Skip if already converted
      if (prospect.convertedLeadId) {
        createdLeadIds.push(prospect.convertedLeadId);
        continue;
      }

      // DNC pre-check
      if (prospect.phone) {
        const isDnc = await checkDnc(prospect.phone);
        if (isDnc) {
          await prisma.prospect.update({
            where: { id: prospect.id },
            data: { dncChecked: true, dncStatus: 'NATIONAL_DNC' },
          });
          dncFiltered++;
          continue;
        }
      }

      // Generate BANT data
      const bant = generateBANT(prospect as Parameters<typeof generateBANT>[0]);

      // Create CrmLead
      const lead = await prisma.crmLead.create({
        data: {
          contactName: prospect.contactName,
          companyName: prospect.companyName,
          email: prospect.email,
          phone: prospect.phone,
          source: 'IMPORT',
          status: 'NEW',
          score: prospect.enrichmentScore || 0,
          temperature: (prospect.enrichmentScore || 0) >= 80 ? 'HOT' : (prospect.enrichmentScore || 0) >= 50 ? 'WARM' : 'COLD',
          customFields: prospect.customFields || undefined,
          qualificationFramework: 'BANT',
          qualificationData: bant as Record<string, string>,
          dncStatus: 'CALLABLE',
        },
      });

      // Link prospect → lead
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
    } catch (err) {
      errors.push({ prospectId: prospect.id, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  // 3. Assign leads to agents
  let assigned = 0;
  if (createdLeadIds.length > 0 && agentIds.length > 0) {
    const list = await prisma.prospectList.findUnique({ where: { id: listId } });
    let result;
    switch (assignmentMethod) {
      case 'ROUND_ROBIN': {
        const config = (list?.assignmentConfig as { currentIndex?: number }) || {};
        result = await assignLeadsBulkRoundRobin(createdLeadIds, agentIds, config.currentIndex || 0);
        if (list) {
          await prisma.prospectList.update({
            where: { id: listId },
            data: { assignmentConfig: { ...(list.assignmentConfig as object || {}), currentIndex: result.nextIndex } },
          });
        }
        break;
      }
      case 'LOAD_BALANCED':
        result = await assignLeadsLoadBalanced(createdLeadIds, agentIds);
        break;
      case 'SCORE_BASED':
        result = await assignLeadsScoreBased(createdLeadIds, agentIds);
        break;
      case 'MANUAL':
        if (agentIds.length === 1) result = await assignLeadsManual(createdLeadIds, agentIds[0]);
        break;
    }
    assigned = result?.assigned || 0;
  }

  // 4. Create DialerCampaign
  const campaign = await prisma.dialerCampaign.create({
    data: {
      companyId,
      name: campaignName,
      status: 'DRAFT',
      callerIdNumber,
      maxConcurrent: options.maxConcurrent || 1,
      useAmd: options.useAmd ?? true,
      scriptTitle: options.scriptTitle || null,
      scriptBody: options.scriptBody || null,
      startTime: options.startTime || '09:00',
      endTime: options.endTime || '17:00',
      timezone: options.timezone || 'America/Montreal',
      activeDays: options.activeDays || ['mon', 'tue', 'wed', 'thu', 'fri'],
      totalContacts: createdLeadIds.length,
    },
  });

  // 5. Create DialerListEntries from CrmLeads
  const leads = await prisma.crmLead.findMany({
    where: { id: { in: createdLeadIds } },
    select: { id: true, contactName: true, email: true, phone: true },
  });

  let entriesCreated = 0;
  for (const lead of leads) {
    if (!lead.phone) continue;

    await prisma.dialerListEntry.create({
      data: {
        campaignId: campaign.id,
        crmLeadId: lead.id,
        phoneNumber: toE164(lead.phone),
        firstName: lead.contactName ? lead.contactName.split(' ')[0] : null,
        lastName: lead.contactName ? lead.contactName.split(' ').slice(1).join(' ') || null : null,
        email: lead.email,
        isDncl: false,
        dnclCheckedAt: new Date(),
      },
    });
    entriesCreated++;
  }

  // Update campaign contact count
  await prisma.dialerCampaign.update({
    where: { id: campaign.id },
    data: { totalContacts: entriesCreated },
  });

  // Update list status
  await prisma.prospectList.update({
    where: { id: listId },
    data: { status: 'INTEGRATED' },
  });
  await updateListCounters(listId);

  logger.info('Campaign bridge completed', {
    campaignId: campaign.id,
    listId,
    leadsCreated: createdLeadIds.length,
    entriesCreated,
    dncFiltered,
    assigned,
  });

  return {
    campaignId: campaign.id,
    leadsCreated: createdLeadIds.length,
    entriesCreated,
    dncFiltered,
    assigned,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Record call outcome as CRM Activity
// ---------------------------------------------------------------------------

export async function recordCallOutcome(
  dialerEntryId: string,
  outcome: {
    type: string;
    duration?: number;
    notes?: string;
    performedById?: string;
  },
): Promise<void> {
  const entry = await prisma.dialerListEntry.findUnique({
    where: { id: dialerEntryId },
    include: { crmLead: true },
  });

  if (!entry?.crmLeadId) return;

  await prisma.crmActivity.create({
    data: {
      type: 'CALL',
      title: `Call: ${outcome.type}`,
      description: outcome.notes || null,
      metadata: {
        dialerEntryId,
        outcome: outcome.type,
        duration: outcome.duration,
      },
      leadId: entry.crmLeadId,
      performedById: outcome.performedById || null,
    },
  });

  // Update lead lastContactedAt
  await prisma.crmLead.update({
    where: { id: entry.crmLeadId },
    data: {
      lastContactedAt: new Date(),
      status: 'CONTACTED',
    },
  });
}
