export const dynamic = 'force-dynamic';

/**
 * CRM Deal Detail API
 * GET    /api/admin/crm/deals/[id] -- Get single deal with all relations
 * PUT    /api/admin/crm/deals/[id] -- Update deal fields
 * DELETE /api/admin/crm/deals/[id] -- Delete a deal
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiNoContent } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { getModuleFlags } from '@/lib/module-flags';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const updateDealSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  value: z.union([z.string(), z.number()]).optional(),
  stageId: z.string().optional(),
  assignedToId: z.string().optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  actualCloseDate: z.string().datetime().optional().nullable(),
  lostReason: z.string().max(2000).optional().nullable(),
  wonReason: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET: Get single deal with all includes
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const deal = await prisma.crmDeal.findUnique({
      where: { id },
      include: {
        stage: true,
        pipeline: {
          include: {
            stages: { orderBy: { position: 'asc' } },
          },
        },
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
        lead: true,
        contact: { select: { id: true, name: true, email: true, image: true } },
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            performedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        stageHistory: {
          include: {
            fromStage: { select: { id: true, name: true, color: true } },
            toStage: { select: { id: true, name: true, color: true } },
            changedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!deal) {
      return apiError('Deal not found', ErrorCode.NOT_FOUND, { request });
    }

    // ── Cross-module bridges (conditional on feature flags) ──────────────
    // Fetch all relevant flags in one query
    const flags = deal.contactId
      ? await getModuleFlags(['ecommerce', 'voip', 'email', 'loyalty', 'accounting'])
      : { ecommerce: false, voip: false, email: false, loyalty: false, accounting: false };

    // Bridge #1/#2: Purchase history (CRM ↔ Commerce)
    let purchaseHistory: {
      recentOrders: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: Date }>;
      totalOrders: number;
      totalSpent: number;
    } | null = null;

    if (deal.contactId && flags.ecommerce) {
      const [recentOrders, aggregation] = await Promise.all([
        prisma.order.findMany({
          where: { userId: deal.contactId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
        }),
        prisma.order.aggregate({
          where: { userId: deal.contactId },
          _count: true,
          _sum: { total: true },
        }),
      ]);
      purchaseHistory = {
        recentOrders: recentOrders.map(o => ({
          ...o,
          total: Number(o.total),
        })),
        totalOrders: aggregation._count,
        totalSpent: Number(aggregation._sum.total || 0),
      };
    }

    // Bridge #7: CRM → Telephonie (call history)
    let callHistory: {
      recentCalls: Array<{ id: string; direction: string; status: string; duration: number; startedAt: Date }>;
      totalCalls: number;
      totalDuration: number;
    } | null = null;

    if (deal.contactId && flags.voip) {
      const [recentCalls, callAgg] = await Promise.all([
        prisma.callLog.findMany({
          where: { clientId: deal.contactId },
          take: 5,
          orderBy: { startedAt: 'desc' },
          select: { id: true, direction: true, status: true, duration: true, startedAt: true },
        }),
        prisma.callLog.aggregate({
          where: { clientId: deal.contactId },
          _count: true,
          _sum: { duration: true },
        }),
      ]);
      callHistory = {
        recentCalls: recentCalls.map((c) => ({
          ...c,
          duration: c.duration ?? 0,
        })),
        totalCalls: callAgg._count,
        totalDuration: callAgg._sum.duration || 0,
      };
    }

    // Bridge #11: CRM → Email (email history)
    let emailHistory: {
      recentEmails: Array<{ id: string; subject: string; status: string; sentAt: Date | null }>;
      totalSent: number;
    } | null = null;

    if (deal.contactId && flags.email) {
      const contactUser = await prisma.user.findUnique({
        where: { id: deal.contactId },
        select: { email: true },
      });
      if (contactUser?.email) {
        const [recentEmails, emailCount] = await Promise.all([
          prisma.emailLog.findMany({
            where: { to: contactUser.email },
            take: 5,
            orderBy: { sentAt: 'desc' },
            select: { id: true, subject: true, status: true, sentAt: true },
          }),
          prisma.emailLog.count({
            where: { to: contactUser.email },
          }),
        ]);
        emailHistory = { recentEmails, totalSent: emailCount };
      }
    }

    // Bridge #15: CRM → Fidélité (loyalty info)
    let loyaltyInfo: {
      currentTier: string;
      currentPoints: number;
    } | null = null;

    if (deal.contactId && flags.loyalty) {
      const loyaltyUser = await prisma.user.findUnique({
        where: { id: deal.contactId },
        select: { loyaltyTier: true, loyaltyPoints: true },
      });
      if (loyaltyUser) {
        loyaltyInfo = {
          currentTier: loyaltyUser.loyaltyTier,
          currentPoints: loyaltyUser.loyaltyPoints,
        };
      }
    }

    // Bridge #50: CRM → Accounting (journal entries from deal's orders)
    let accountingInfo: {
      totalInvoiced: number;
      totalPaid: number;
      outstandingBalance: number;
      recentEntries: Array<{ id: string; entryNumber: string; description: string | null; date: Date; type: string }>;
    } | null = null;

    if (deal.contactId && flags.accounting && purchaseHistory && purchaseHistory.totalOrders > 0) {
      const orderIds = (await prisma.order.findMany({
        where: { userId: deal.contactId },
        select: { id: true },
        take: 50,
      })).map((o) => o.id);

      if (orderIds.length > 0) {
        const entries = await prisma.journalEntry.findMany({
          where: { orderId: { in: orderIds } },
          take: 10,
          orderBy: { date: 'desc' },
          select: { id: true, entryNumber: true, description: true, date: true, type: true },
        });

        const invoices = await prisma.customerInvoice.findMany({
          where: { customerId: deal.contactId },
          select: { total: true, status: true },
        });

        const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.total), 0);
        const totalPaid = invoices
          .filter((inv) => inv.status === 'PAID')
          .reduce((s, inv) => s + Number(inv.total), 0);

        accountingInfo = {
          totalInvoiced,
          totalPaid,
          outstandingBalance: totalInvoiced - totalPaid,
          recentEntries: entries,
        };
      }
    }

    return apiSuccess(
      { ...deal, purchaseHistory, callHistory, emailHistory, loyaltyInfo, accountingInfo },
      { request }
    );
  } catch (error) {
    logger.error('[crm/deals/[id]] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch deal', ErrorCode.INTERNAL_ERROR, { request });
  }
});

// ---------------------------------------------------------------------------
// PUT: Update deal fields
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateDealSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    // Check deal exists
    const existing = await prisma.crmDeal.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return apiError('Deal not found', ErrorCode.NOT_FOUND, { request });
    }

    const data: Prisma.CrmDealUpdateInput = {};
    const {
      title, value, stageId, assignedToId,
      expectedCloseDate, actualCloseDate,
      lostReason, wonReason, tags, customFields,
    } = parsed.data;

    if (title !== undefined) data.title = title;
    if (value !== undefined) data.value = new Prisma.Decimal(String(value));
    if (stageId !== undefined) data.stage = { connect: { id: stageId } };
    if (assignedToId !== undefined) data.assignedTo = { connect: { id: assignedToId } };
    if (expectedCloseDate !== undefined) {
      data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    }
    if (actualCloseDate !== undefined) {
      data.actualCloseDate = actualCloseDate ? new Date(actualCloseDate) : null;
    }
    if (lostReason !== undefined) data.lostReason = lostReason;
    if (wonReason !== undefined) data.wonReason = wonReason;
    if (tags !== undefined) data.tags = tags;
    if (customFields !== undefined) {
      data.customFields = customFields ? JSON.parse(JSON.stringify(customFields)) : Prisma.JsonNull;
    }

    const deal = await prisma.crmDeal.update({
      where: { id },
      data,
      include: {
        stage: { select: { id: true, name: true, color: true, probability: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, contactName: true } },
        contact: { select: { id: true, name: true, email: true } },
      },
    });

    logger.info('[crm/deals/[id]] Deal updated', { dealId: id });

    return apiSuccess(deal, { request });
  } catch (error) {
    logger.error('[crm/deals/[id]] PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to update deal', ErrorCode.INTERNAL_ERROR, { request });
  }
});

// ---------------------------------------------------------------------------
// DELETE: Delete a deal
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const existing = await prisma.crmDeal.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return apiError('Deal not found', ErrorCode.NOT_FOUND, { request });
    }

    await prisma.crmDeal.delete({ where: { id } });

    logger.info('[crm/deals/[id]] Deal deleted', { dealId: id });

    return apiNoContent({ request });
  } catch (error) {
    logger.error('[crm/deals/[id]] DELETE error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to delete deal', ErrorCode.INTERNAL_ERROR, { request });
  }
});
