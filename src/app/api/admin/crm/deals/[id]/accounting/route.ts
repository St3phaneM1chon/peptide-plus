export const dynamic = 'force-dynamic';

/**
 * CRM Deal → Accounting Bridge Endpoint (Bridge #50)
 * GET /api/admin/crm/deals/[id]/accounting
 * Returns accounting data related to a deal's contact's orders.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const deal = await prisma.crmDeal.findUnique({
    where: { id },
    select: { id: true, contactId: true, title: true },
  });

  if (!deal) {
    return apiError('Deal not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  if (!deal.contactId) {
    return apiSuccess({
      dealId: deal.id,
      dealName: deal.title,
      totalInvoiced: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      recentEntries: [],
      message: 'No contact associated with this deal',
    }, { request });
  }

  // Get orders for this contact
  const orders = await prisma.order.findMany({
    where: { userId: deal.contactId },
    select: { id: true, total: true, status: true },
    take: 100,
  });

  const orderIds = orders.map((o: { id: string }) => o.id);

  if (orderIds.length === 0) {
    return apiSuccess({
      dealId: deal.id,
      dealName: deal.title,
      totalInvoiced: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      recentEntries: [],
      message: 'No orders found for this contact',
    }, { request });
  }

  // Get journal entries for these orders
  const entries = await prisma.journalEntry.findMany({
    where: { orderId: { in: orderIds } },
    take: 20,
    orderBy: { date: 'desc' },
    select: { id: true, entryNumber: true, description: true, date: true, type: true },
  });

  // Calculate totals from orders (no Invoice model exists)
  const totalInvoiced = orders.reduce((s: number, o: { total: unknown }) => s + Number(o.total), 0);
  const totalPaid = orders
    .filter((o: { status: string }) => o.status === 'DELIVERED' || o.status === 'COMPLETED')
    .reduce((s: number, o: { total: unknown }) => s + Number(o.total), 0);

  return apiSuccess({
    dealId: deal.id,
    dealName: deal.title,
    contactId: deal.contactId,
    totalInvoiced,
    totalPaid,
    outstandingBalance: totalInvoiced - totalPaid,
    recentEntries: entries,
    orderCount: orderIds.length,
  }, { request });
}, { requiredPermission: 'crm.contacts.view' });
