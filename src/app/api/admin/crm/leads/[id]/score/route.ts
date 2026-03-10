export const dynamic = 'force-dynamic';

/**
 * CRM Lead Scoring API
 * POST /api/admin/crm/leads/[id]/score - Recalculate lead score and temperature
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Scoring Engine
// ---------------------------------------------------------------------------

/**
 * Calculate a lead score (0-100) based on profile completeness,
 * engagement signals, and source quality.
 */
async function calculateLeadScore(leadId: string): Promise<number> {
  const lead = await prisma.crmLead.findUnique({
    where: { id: leadId },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  if (!lead) return 0;

  let score = 0;

  // Profile completeness
  if (lead.email) score += 15;
  if (lead.phone) score += 15;
  if (lead.companyName) score += 10;

  // Engagement: was contacted
  if (lead.lastContactedAt) score += 20;

  // Engagement: has recent activity (within last 30 days)
  if (lead.activities.length > 0) {
    const lastActivity = lead.activities[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (lastActivity.createdAt >= thirtyDaysAgo) {
      score += 20;
    }
  }

  // Source bonus
  switch (lead.source) {
    case 'REFERRAL':
      score += 20;
      break;
    case 'WEB':
    case 'CAMPAIGN':
      score += 10;
      break;
    default:
      break;
  }

  // Cap at 100
  return Math.min(100, score);
}

/**
 * Determine temperature from score.
 */
function scoreToTemperature(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 70) return 'HOT';
  if (score >= 40) return 'WARM';
  return 'COLD';
}

// ---------------------------------------------------------------------------
// POST: Recalculate lead score
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const existing = await prisma.crmLead.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return apiError('Lead not found', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }

  const score = await calculateLeadScore(id);
  const temperature = scoreToTemperature(score);

  const lead = await prisma.crmLead.update({
    where: { id },
    data: { score, temperature },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      sourceProspect: {
        select: { id: true },
      },
    },
  });

  // Sync score back to the source Prospect if one exists (via ProspectToLead relation)
  if (lead.sourceProspect) {
    try {
      await prisma.prospect.update({
        where: { id: lead.sourceProspect.id },
        data: { enrichmentScore: score },
      });
    } catch (syncError) {
      logger.warn('[CRM Lead Score] Failed to sync score to Prospect', {
        leadId: id,
        prospectId: lead.sourceProspect.id,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

  return apiSuccess(lead, { request });
}, { requiredPermission: 'crm.leads.edit' });
