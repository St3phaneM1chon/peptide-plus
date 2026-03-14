export const dynamic = 'force-dynamic';

/**
 * CRM Rep Commissions API
 * GET  /api/admin/crm/reps/[id]/commissions - List commission payouts for agent
 * POST /api/admin/crm/reps/[id]/commissions - Calculate commission for a period
 * PATCH /api/admin/crm/reps/[id]/commissions?payoutId=... - Approve/reject a payout
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const calculateCommissionSchema = z.object({
  tierId: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

const approvePayoutSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'PAID']),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET: List commission payouts for agent (paginated)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10)));
    const skip = (page - 1) * pageSize;

    const [payouts, total] = await Promise.all([
      prisma.commissionPayout.findMany({
        where: { agentId: id },
        include: { tier: true },
        orderBy: { periodStart: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.commissionPayout.count({ where: { agentId: id } }),
    ]);

    return apiPaginated(payouts, page, pageSize, total, { request });
  } catch (error) {
    logger.error('[crm/reps/commissions] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to list commission payouts', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.view' });

// ---------------------------------------------------------------------------
// POST: Calculate commission for a period
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = calculateCommissionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid request body', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const { tierId, periodStart, periodEnd } = parsed.data;
    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);

    // Fetch the tier
    const tier = await prisma.repBonusTier.findUnique({ where: { id: tierId } });
    if (!tier) {
      return apiError('Bonus tier not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    // -----------------------------------------------------------------------
    // 1. Aggregate sales: won deals assigned to agent within the period
    // -----------------------------------------------------------------------
    const wonDeals = await prisma.crmDeal.findMany({
      where: {
        assignedToId: id,
        actualCloseDate: { gte: pStart, lte: pEnd },
        stage: { isWon: true },
      },
      include: {
        dealTeamMembers: {
          where: { userId: id },
        },
      },
    });

    let salesRevenue = 0;
    for (const deal of wonDeals) {
      const teamMember = deal.dealTeamMembers.find((m) => m.userId === id);
      if (teamMember) {
        salesRevenue += Number(deal.value) * Number(teamMember.splitPercent) / 100;
      } else {
        // Agent is assignee but not in deal team — count full value
        salesRevenue += Number(deal.value);
      }
    }

    // -----------------------------------------------------------------------
    // 2 & 3. Aggregate activities + lead scores in parallel (N+1 fix)
    // -----------------------------------------------------------------------
    const [statsAgg, leadScoreAgg] = await Promise.all([
      prisma.agentDailyStats.aggregate({
        where: {
          agentId: id,
          date: { gte: pStart, lte: pEnd },
        },
        _sum: {
          callsMade: true,
          conversions: true,
        },
      }),
      prisma.crmLead.aggregate({
        where: {
          assignedToId: id,
          lastContactedAt: { gte: pStart, lte: pEnd },
        },
        _avg: {
          score: true,
        },
      }),
    ]);

    const calls = statsAgg._sum.callsMade ?? 0;
    const appointments = statsAgg._sum.conversions ?? 0;
    const avgScore = leadScoreAgg._avg.score ?? 0;

    // -----------------------------------------------------------------------
    // 4. Check eligibility
    // -----------------------------------------------------------------------
    const meetsVolume = !tier.minVolume || (calls + appointments) >= tier.minVolume;
    const meetsPrequal = !tier.minPrequalScore || avgScore >= tier.minPrequalScore;
    const isEligible = meetsVolume && meetsPrequal;

    // -----------------------------------------------------------------------
    // 5. Sales payout (SALES or HYBRID)
    // -----------------------------------------------------------------------
    let salesPayout = 0;
    if (isEligible && (tier.commissionType === 'SALES' || tier.commissionType === 'HYBRID')) {
      const revenueThreshold = tier.revenueThreshold ? Number(tier.revenueThreshold) : 0;
      const commissionRate = tier.commissionRate ? Number(tier.commissionRate) : 0;
      if (salesRevenue >= revenueThreshold) {
        salesPayout = salesRevenue * commissionRate;
      }
    }

    // -----------------------------------------------------------------------
    // 6. Activity payout (ACTIVITY or HYBRID)
    // -----------------------------------------------------------------------
    let activityPayout = 0;
    if (isEligible && (tier.commissionType === 'ACTIVITY' || tier.commissionType === 'HYBRID')) {
      const ratePerCall = tier.ratePerCall ? Number(tier.ratePerCall) : 0;
      const ratePerAppointment = tier.ratePerAppointment ? Number(tier.ratePerAppointment) : 0;
      activityPayout = calls * ratePerCall + appointments * ratePerAppointment;
    }

    // -----------------------------------------------------------------------
    // 7. Total payout capped by maxPayout
    // -----------------------------------------------------------------------
    const maxPayout = tier.maxPayout ? Number(tier.maxPayout) : Infinity;
    const totalPayout = Math.min(salesPayout + activityPayout, maxPayout);

    // -----------------------------------------------------------------------
    // 8. Upsert CommissionPayout
    // -----------------------------------------------------------------------
    const payout = await prisma.commissionPayout.upsert({
      where: {
        agentId_tierId_periodStart_periodEnd: {
          agentId: id,
          tierId,
          periodStart: pStart,
          periodEnd: pEnd,
        },
      },
      update: {
        salesRevenue,
        salesPayout,
        callsCount: calls,
        appointmentsCount: appointments,
        activityPayout,
        totalPayout,
        meetsVolumeThreshold: meetsVolume,
        meetsPrequalThreshold: meetsPrequal,
        avgPrequalScore: Math.round(avgScore),
        isEligible,
        status: 'PENDING',
      },
      create: {
        agentId: id,
        tierId,
        periodStart: pStart,
        periodEnd: pEnd,
        salesRevenue,
        salesPayout,
        callsCount: calls,
        appointmentsCount: appointments,
        activityPayout,
        totalPayout,
        meetsVolumeThreshold: meetsVolume,
        meetsPrequalThreshold: meetsPrequal,
        avgPrequalScore: Math.round(avgScore),
        isEligible,
        status: 'PENDING',
      },
      include: { tier: true },
    });

    return apiSuccess(payout, { status: 201, request });
  } catch (error) {
    logger.error('[crm/reps/commissions] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to calculate commission', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.edit' });

// ---------------------------------------------------------------------------
// PATCH: Approve/reject a payout
// ---------------------------------------------------------------------------

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const payoutId = url.searchParams.get('payoutId');

    if (!payoutId) {
      return apiError('payoutId query parameter is required', ErrorCode.VALIDATION_ERROR, { status: 400, request });
    }

    const body = await request.json();
    const parsed = approvePayoutSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid request body', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    // Verify the payout belongs to this agent
    const existing = await prisma.commissionPayout.findFirst({
      where: { id: payoutId, agentId: id },
    });

    if (!existing) {
      return apiError('Commission payout not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    const { status, notes } = parsed.data;

    const updateData: Record<string, unknown> = {
      status,
      approvedById: session.user.id,
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (status === 'PAID') {
      updateData.paidAt = new Date();
    }

    const updated = await prisma.commissionPayout.update({
      where: { id: payoutId },
      data: updateData,
      include: { tier: true },
    });

    return apiSuccess(updated, { request });
  } catch (error) {
    logger.error('[crm/reps/commissions] PATCH error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to update commission payout', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.edit' });
