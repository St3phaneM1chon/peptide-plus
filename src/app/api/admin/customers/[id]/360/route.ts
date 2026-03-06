export const dynamic = 'force-dynamic';

/**
 * Customer 360 API
 * GET /api/admin/customers/[id]/360?modules=commerce,crm,voip,...
 *
 * Unified cross-module view of a customer. Each section gated by feature flag.
 * Fetches all enabled modules in parallel for performance.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { getModuleFlags, type ModuleKey } from '@/lib/module-flags';
import { computeHealthScore } from '@/lib/customer-health';
import { logger } from '@/lib/logger';

const ALL_MODULES: ModuleKey[] = [
  'ecommerce', 'crm', 'voip', 'email', 'loyalty', 'marketing', 'community', 'accounting', 'media',
];

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const requestedModules = url.searchParams.get('modules')?.split(',').filter(Boolean) as ModuleKey[] | undefined;
    const modulesToCheck = requestedModules ?? ALL_MODULES;

    // Fetch user + module flags in parallel
    const [user, flags] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true, name: true, email: true, phone: true, image: true, createdAt: true,
          loyaltyTier: true, loyaltyPoints: true, lifetimePoints: true,
          role: true, isBanned: true,
        },
      }),
      getModuleFlags(modulesToCheck),
    ]);

    if (!user) {
      return apiError('User not found', ErrorCode.NOT_FOUND, { request });
    }

    // Build module data in parallel
    const moduleData: Record<string, unknown> = {};
    const promises: Promise<void>[] = [];

    // ── Commerce ─────────────────────────────────────────
    if (flags.ecommerce) {
      promises.push((async () => {
        const [orders, agg] = await Promise.all([
          prisma.order.findMany({
            where: { userId: id },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
          }),
          prisma.order.aggregate({
            where: { userId: id },
            _count: true,
            _sum: { total: true },
          }),
        ]);
        moduleData.commerce = {
          enabled: true,
          recentOrders: orders.map((o) => ({ ...o, total: Number(o.total) })),
          totalOrders: agg._count,
          totalSpent: Number(agg._sum.total ?? 0),
        };
      })());
    }

    // ── CRM ──────────────────────────────────────────────
    if (flags.crm) {
      promises.push((async () => {
        const deals = await prisma.crmDeal.findMany({
          where: { contactId: id },
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true, title: true, value: true,
            stage: { select: { name: true } },
          },
        });
        moduleData.crm = {
          enabled: true,
          deals: deals.map((d) => ({
            id: d.id, title: d.title, stageName: d.stage.name, value: Number(d.value),
          })),
          totalDeals: deals.length,
        };
      })());
    }

    // ── VoIP ─────────────────────────────────────────────
    if (flags.voip) {
      promises.push((async () => {
        const [calls, agg] = await Promise.all([
          prisma.callLog.findMany({
            where: { clientId: id },
            take: 5,
            orderBy: { startedAt: 'desc' },
            select: { id: true, direction: true, status: true, duration: true, startedAt: true },
          }),
          prisma.callLog.aggregate({
            where: { clientId: id },
            _count: true,
            _sum: { duration: true },
          }),
        ]);
        moduleData.voip = {
          enabled: true,
          recentCalls: calls.map((c) => ({ ...c, duration: c.duration ?? 0 })),
          totalCalls: agg._count,
          totalDuration: agg._sum.duration ?? 0,
        };
      })());
    }

    // ── Email ────────────────────────────────────────────
    if (flags.email) {
      promises.push((async () => {
        const [emails, count] = await Promise.all([
          prisma.emailLog.findMany({
            where: { userId: id },
            take: 5,
            orderBy: { sentAt: 'desc' },
            select: { id: true, subject: true, status: true, sentAt: true },
          }),
          prisma.emailLog.count({ where: { userId: id } }),
        ]);
        moduleData.email = {
          enabled: true,
          recentEmails: emails.map((e) => ({ ...e, sentAt: e.sentAt.toISOString() })),
          totalSent: count,
        };
      })());
    }

    // ── Loyalty ──────────────────────────────────────────
    if (flags.loyalty) {
      moduleData.loyalty = {
        enabled: true,
        currentTier: user.loyaltyTier,
        currentPoints: user.loyaltyPoints,
        lifetimePoints: user.lifetimePoints,
      };
    }

    // ── Marketing ────────────────────────────────────────
    if (flags.marketing) {
      promises.push((async () => {
        const promoUsages = await prisma.promoCodeUsage.count({
          where: { userId: id },
        });
        moduleData.marketing = {
          enabled: true,
          promosUsed: promoUsages,
          totalDiscount: 0, // Would need sum of discount column
        };
      })());
    }

    // ── Community ────────────────────────────────────────
    if (flags.community) {
      promises.push((async () => {
        const [reviews, posts, ambassador] = await Promise.all([
          prisma.review.count({ where: { userId: id } }),
          prisma.forumPost.count({ where: { authorId: id } }),
          prisma.ambassador.findFirst({ where: { userId: id }, select: { id: true } }),
        ]);
        moduleData.community = {
          enabled: true,
          reviews,
          forumPosts: posts,
          isAmbassador: !!ambassador,
        };
      })());
    }

    // ── Accounting ───────────────────────────────────────
    if (flags.accounting) {
      promises.push((async () => {
        // Outstanding invoices for this customer
        const invoices = await prisma.customerInvoice.count({
          where: { customerId: id, status: { in: ['DRAFT', 'SENT', 'OVERDUE'] } },
        });
        moduleData.accounting = {
          enabled: true,
          outstandingInvoices: invoices,
          totalPaid: 0,
        };
      })());
    }

    // ── Media ────────────────────────────────────────────
    if (flags.media) {
      promises.push((async () => {
        const consents = await prisma.siteConsent.count({
          where: { clientId: id },
        });
        moduleData.media = { enabled: true, consents };
      })());
    }

    await Promise.all(promises);

    // ── Compute health score ─────────────────────────────
    const commerce = moduleData.commerce as { totalOrders: number; totalSpent: number; recentOrders: { createdAt: Date }[] } | undefined;
    const lastOrderDate = commerce?.recentOrders?.[0]?.createdAt;
    const daysSinceLastOrder = lastOrderDate
      ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const healthScore = computeHealthScore({
      daysSinceLastOrder,
      totalOrders: commerce?.totalOrders ?? 0,
      totalSpent: commerce?.totalSpent ?? 0,
      openDeals: ((moduleData.crm as { totalDeals: number })?.totalDeals) ?? 0,
      recentCalls: ((moduleData.voip as { totalCalls: number })?.totalCalls) ?? 0,
      emailOpenRate: null,
      loyaltyTier: user.loyaltyTier,
      reviewCount: ((moduleData.community as { reviews: number })?.reviews) ?? 0,
      hasOpenTickets: false,
    });

    return apiSuccess(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          image: user.image,
          createdAt: user.createdAt.toISOString(),
        },
        healthScore,
        modules: moduleData,
      },
      { request }
    );
  } catch (error) {
    logger.error('[customers/[id]/360] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch customer 360', ErrorCode.INTERNAL_ERROR, { request });
  }
});
