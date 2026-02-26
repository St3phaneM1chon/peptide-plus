/**
 * Public API v1 - Invoices (single)
 * GET /api/v1/invoices/:id - Get a single invoice by ID or invoice number
 */

import { NextRequest } from 'next/server';
import { withApiAuth, jsonSuccess, jsonError } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

export const GET = withApiAuth(async (_request: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) {
    return jsonError('Invoice ID is required', 400);
  }

  const invoice = await prisma.customerInvoice.findFirst({
    where: {
      OR: [{ id }, { invoiceNumber: id }],
      deletedAt: null,
    },
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
      journalEntryId: true,
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
      creditNotes: {
        select: {
          id: true,
          creditNoteNumber: true,
          total: true,
          reason: true,
          status: true,
          issuedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!invoice) {
    return jsonError('Invoice not found', 404);
  }

  return jsonSuccess(invoice);
}, 'invoices:read');
