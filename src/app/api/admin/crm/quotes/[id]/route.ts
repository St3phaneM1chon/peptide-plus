export const dynamic = 'force-dynamic';

/**
 * CRM Quote Detail API
 * GET    /api/admin/crm/quotes/[id] - Get single quote with full details
 * PUT    /api/admin/crm/quotes/[id] - Update quote (status, items, notes, terms)
 * DELETE /api/admin/crm/quotes/[id] - Delete quote (only DRAFT status)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiNoContent } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const quoteItemUpdateSchema = z.object({
  id: z.string().cuid().optional(), // existing item ID for updates
  productId: z.string().cuid().optional().nullable(),
  description: z.string().min(1).max(500).trim(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
  position: z.number().int().min(0).optional(),
});

const updateQuoteSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
  currency: z.string().max(3).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  validUntil: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).trim().optional().nullable(),
  terms: z.string().max(10000).trim().optional().nullable(),
  items: z.array(quoteItemUpdateSchema).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateTotals(
  items: Array<{ quantity: number; unitPrice: number; discount: number }>,
  taxRate: number
) {
  const itemTotals = items.map((item) => {
    const discountMultiplier = 1 - (item.discount || 0) / 100;
    return Math.round(item.quantity * item.unitPrice * discountMultiplier * 100) / 100;
  });
  const subtotal = Math.round(itemTotals.reduce((sum, t) => sum + t, 0) * 100) / 100;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  return { itemTotals, subtotal, taxAmount, total };
}

// Full include object for returning complete quote details
const fullQuoteInclude = {
  deal: {
    select: {
      id: true,
      title: true,
      value: true,
      currency: true,
      pipeline: {
        select: { id: true, name: true },
      },
      stage: {
        select: { id: true, name: true, color: true, probability: true },
      },
      lead: {
        select: {
          id: true,
          contactName: true,
          companyName: true,
          email: true,
          phone: true,
        },
      },
      contact: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  items: {
    orderBy: { position: 'asc' as const },
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
    },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
};

// ---------------------------------------------------------------------------
// GET: Get single quote
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const { id } = params;

  const quote = await prisma.crmQuote.findUnique({
    where: { id },
    include: fullQuoteInclude,
  });

  if (!quote) {
    return apiError('Quote not found', ErrorCode.RESOURCE_NOT_FOUND, {
      status: 404,
      request,
    });
  }

  return apiSuccess(quote, { request });
}, { requiredPermission: 'crm.deals.view' });

// ---------------------------------------------------------------------------
// PUT: Update quote
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const { id } = params;
  const body = await request.json();
  const parsed = updateQuoteSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  // Fetch existing quote
  const existing = await prisma.crmQuote.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existing) {
    return apiError('Quote not found', ErrorCode.RESOURCE_NOT_FOUND, {
      status: 404,
      request,
    });
  }

  const { status, currency, taxRate, validUntil, notes, terms, items } = parsed.data;

  // Status transition validation
  if (status) {
    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['SENT'],
      SENT: ['VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
      VIEWED: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
      ACCEPTED: [],
      REJECTED: ['DRAFT'], // allow re-drafting a rejected quote
      EXPIRED: ['DRAFT'],  // allow re-drafting an expired quote
    };

    const currentStatus = existing.status;
    const allowed = allowedTransitions[currentStatus] || [];

    if (!allowed.includes(status)) {
      return apiError(
        `Cannot transition from ${currentStatus} to ${status}`,
        ErrorCode.VALIDATION_ERROR,
        { status: 400, request }
      );
    }
  }

  // Build update data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if (status !== undefined) {
    updateData.status = status;
    // Track status-related timestamps
    if (status === 'SENT') updateData.sentAt = new Date();
    if (status === 'VIEWED') updateData.viewedAt = new Date();
    if (status === 'ACCEPTED') updateData.signedAt = new Date();
  }
  if (currency !== undefined) updateData.currency = currency;
  if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
  if (notes !== undefined) updateData.notes = notes;
  if (terms !== undefined) updateData.terms = terms;

  // Determine the effective tax rate for recalculation
  const effectiveTaxRate = taxRate !== undefined ? taxRate : Number(existing.taxRate);
  if (taxRate !== undefined) updateData.taxRate = taxRate;

  // If items are provided, replace all items and recalculate totals
  if (items && items.length > 0) {
    const { itemTotals, subtotal, taxAmount, total } = calculateTotals(items, effectiveTaxRate);
    updateData.subtotal = subtotal;
    updateData.taxAmount = taxAmount;
    updateData.total = total;

    // Use a transaction: delete old items, create new ones, update quote
    const updatedQuote = await prisma.$transaction(async (tx) => {
      // Delete all existing items
      await tx.crmQuoteItem.deleteMany({ where: { quoteId: id } });

      // Create new items
      await tx.crmQuoteItem.createMany({
        data: items.map((item, index) => ({
          quoteId: id,
          productId: item.productId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          total: itemTotals[index],
          position: item.position ?? index,
        })),
      });

      // Update quote
      return tx.crmQuote.update({
        where: { id },
        data: updateData,
        include: fullQuoteInclude,
      });
    });

    logger.info('CRM quote updated with new items', {
      event: 'crm_quote_updated',
      quoteId: id,
      quoteNumber: existing.number,
      itemCount: items.length,
      total: updateData.total?.toString(),
    });

    return apiSuccess(updatedQuote, { request });
  }

  // If only metadata update (no items change), recalculate if taxRate changed
  if (taxRate !== undefined && !items) {
    const existingItems = existing.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
    }));
    const { subtotal, taxAmount, total } = calculateTotals(existingItems, effectiveTaxRate);
    updateData.subtotal = subtotal;
    updateData.taxAmount = taxAmount;
    updateData.total = total;
  }

  if (Object.keys(updateData).length === 0) {
    return apiError('No valid fields to update', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      request,
    });
  }

  const updatedQuote = await prisma.crmQuote.update({
    where: { id },
    data: updateData,
    include: fullQuoteInclude,
  });

  logger.info('CRM quote updated', {
    event: 'crm_quote_updated',
    quoteId: id,
    quoteNumber: existing.number,
    changes: Object.keys(updateData),
  });

  return apiSuccess(updatedQuote, { request });
}, { requiredPermission: 'crm.deals.edit' });

// ---------------------------------------------------------------------------
// DELETE: Delete quote (only DRAFT status)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const { id } = params;

  const existing = await prisma.crmQuote.findUnique({
    where: { id },
    select: { id: true, number: true, status: true },
  });

  if (!existing) {
    return apiError('Quote not found', ErrorCode.RESOURCE_NOT_FOUND, {
      status: 404,
      request,
    });
  }

  if (existing.status !== 'DRAFT') {
    return apiError(
      'Only DRAFT quotes can be deleted. Change status back to DRAFT first.',
      ErrorCode.VALIDATION_ERROR,
      { status: 400, request }
    );
  }

  // CrmQuoteItem has onDelete: Cascade, so items are auto-deleted
  await prisma.crmQuote.delete({ where: { id } });

  logger.info('CRM quote deleted', {
    event: 'crm_quote_deleted',
    quoteId: id,
    quoteNumber: existing.number,
  });

  return apiNoContent({ request });
}, { requiredPermission: 'crm.deals.delete' });
