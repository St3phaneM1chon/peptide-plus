/**
 * Public API v1 - Invoices (list)
 * GET /api/v1/invoices - List customer invoices (paginated, filterable)
 */

import { NextRequest } from 'next/server';
import { withApiAuth, jsonSuccess } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

export const GET = withApiAuth(async (request: NextRequest) => {
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const status = url.searchParams.get('status');
  const customerId = url.searchParams.get('customerId');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const overdue = url.searchParams.get('overdue');
  const sortBy = url.searchParams.get('sortBy') || 'invoiceDate';
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    deletedAt: null, // Only non-deleted invoices
  };

  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (dateFrom || dateTo) {
    where.invoiceDate = {};
    if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
    if (dateTo) where.invoiceDate.lte = new Date(dateTo);
  }
  if (overdue === 'true') {
    where.status = { in: ['SENT', 'OVERDUE'] };
    where.dueDate = { lt: new Date() };
  }

  const allowedSortFields = ['invoiceDate', 'dueDate', 'total', 'invoiceNumber', 'createdAt'];
  const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'invoiceDate';

  const [invoices, total] = await Promise.all([
    prisma.customerInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orderByField]: sortOrder },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        customerName: true,
        customerEmail: true,
        customerAddress: true,
        orderId: true,
        subtotal: true,
        shippingCost: true,
        discount: true,
        taxTps: true,
        taxTvq: true,
        taxTvh: true,
        taxPst: true,
        total: true,
        amountPaid: true,
        balance: true,
        currency: true,
        invoiceDate: true,
        dueDate: true,
        paidAt: true,
        status: true,
        pdfUrl: true,
        notes: true,
        remindersSent: true,
        lastReminderAt: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            total: true,
            productId: true,
            productSku: true,
          },
        },
      },
    }),
    prisma.customerInvoice.count({ where }),
  ]);

  return jsonSuccess(invoices, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}, 'invoices:read');
