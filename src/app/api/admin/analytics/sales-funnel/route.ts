export const dynamic = 'force-dynamic';

/**
 * Cross-Module Analytics #1: Sales Funnel
 * GET /api/admin/analytics/sales-funnel
 *
 * Lead → Deal → Order → Payment → Revenue pipeline conversion.
 * Crosses: CRM + Commerce + Accounting
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess } from '@/lib/api-response';
import { getModuleFlags } from '@/lib/module-flags';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params: _params }: { session: unknown; params: Promise<{ id?: string }> }
) => {
  const flags = await getModuleFlags(['crm', 'ecommerce', 'accounting']);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  // ── Stage 1: Leads created ──
  let leadsCreated = 0;
  let leadsConverted = 0;
  if (flags.crm) {
    [leadsCreated, leadsConverted] = await Promise.all([
      prisma.crmLead.count({ where: { createdAt: { gte: since } } }),
      prisma.crmLead.count({ where: { createdAt: { gte: since }, status: 'CONVERTED' } }),
    ]);
  }

  // ── Stage 2: Deals ──
  let dealsCreated = 0;
  let dealsWon = 0;
  let dealValueWon = 0;
  if (flags.crm) {
    const [created, wonDeals] = await Promise.all([
      prisma.crmDeal.count({ where: { createdAt: { gte: since } } }),
      prisma.crmDeal.findMany({
        where: { createdAt: { gte: since }, stage: { isWon: true } },
        select: { value: true },
      }),
    ]);
    dealsCreated = created;
    dealsWon = wonDeals.length;
    dealValueWon = wonDeals.reduce((s, d) => s + Number(d.value || 0), 0);
  }

  // ── Stage 3: Orders ──
  let ordersCreated = 0;
  let ordersPaid = 0;
  let totalRevenue = 0;
  if (flags.ecommerce) {
    const [created, paidOrders] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: since } } }),
      prisma.order.findMany({
        where: { createdAt: { gte: since }, paymentStatus: 'PAID' },
        select: { total: true },
      }),
    ]);
    ordersCreated = created;
    ordersPaid = paidOrders.length;
    totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
  }

  // ── Stage 4: Accounting entries ──
  let journalEntriesCreated = 0;
  if (flags.accounting) {
    journalEntriesCreated = await prisma.journalEntry.count({
      where: { date: { gte: since } },
    });
  }

  // ── Conversion rates ──
  const leadToDeadRate = leadsCreated > 0 ? (leadsConverted / leadsCreated) * 100 : 0;
  const dealWinRate = dealsCreated > 0 ? (dealsWon / dealsCreated) * 100 : 0;
  const orderPayRate = ordersCreated > 0 ? (ordersPaid / ordersCreated) * 100 : 0;

  const funnel = [
    { stage: 'leads', count: leadsCreated, label: 'Leads Created' },
    { stage: 'leadsConverted', count: leadsConverted, label: 'Leads Converted', rate: leadToDeadRate },
    { stage: 'deals', count: dealsCreated, label: 'Deals Created' },
    { stage: 'dealsWon', count: dealsWon, label: 'Deals Won', rate: dealWinRate },
    { stage: 'orders', count: ordersCreated, label: 'Orders Created' },
    { stage: 'ordersPaid', count: ordersPaid, label: 'Orders Paid', rate: orderPayRate },
  ];

  return apiSuccess({
    period: { days, since: since.toISOString() },
    funnel,
    summary: {
      leadsCreated,
      leadsConverted,
      dealsCreated,
      dealsWon,
      dealValueWon,
      ordersCreated,
      ordersPaid,
      totalRevenue,
      journalEntriesCreated,
      leadToDeadRate: Math.round(leadToDeadRate * 10) / 10,
      dealWinRate: Math.round(dealWinRate * 10) / 10,
      orderPayRate: Math.round(orderPayRate * 10) / 10,
    },
    modules: flags,
  }, { request });
});
