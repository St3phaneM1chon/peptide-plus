export const dynamic = 'force-dynamic';

/**
 * Admin CRM Dashboard API
 * GET - Returns aggregated CRM stats for the dashboard
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      totalLeads,
      leadsThisMonth,
      totalDeals,
      openDeals,
      totalTickets,
      openTickets,
      totalActivities,
      activitiesThisMonth,
      totalPipelines,
    ] = await Promise.all([
      prisma.crmLead.count(),
      prisma.crmLead.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.crmDeal.count(),
      prisma.crmDeal.count({ where: { actualCloseDate: null } }),
      prisma.crmTicket.count(),
      prisma.crmTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.crmActivity.count(),
      prisma.crmActivity.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.crmPipeline.count(),
    ]);

    return NextResponse.json({
      leads: { total: totalLeads, thisMonth: leadsThisMonth },
      deals: { total: totalDeals, open: openDeals },
      tickets: { total: totalTickets, open: openTickets },
      activities: { total: totalActivities, thisMonth: activitiesThisMonth },
      pipelines: totalPipelines,
    });
  } catch (error) {
    logger.error('Admin CRM dashboard GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
