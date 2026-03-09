export const dynamic = 'force-dynamic';

/**
 * CRM Quotes API
 * GET  /api/admin/crm/quotes - List quotes with filters, search, pagination
 * POST /api/admin/crm/quotes - Create a new quote with line items
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const quoteItemSchema = z.object({
  productId: z.string().cuid().optional().nullable(),
  description: z.string().min(1, 'Description is required').max(500).trim(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  discount: z.number().min(0).max(100).default(0), // percentage
  position: z.number().int().min(0).optional(),
});

const createQuoteSchema = z.object({
  dealId: z.string().cuid('A valid deal ID is required'),
  currency: z.string().max(3).default('CAD'),
  taxRate: z.number().min(0).max(1).default(0), // e.g. 0.14975 for QC
  validUntil: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).trim().optional().nullable(),
  terms: z.string().max(10000).trim().optional().nullable(),
  items: z.array(quoteItemSchema).min(1, 'At least one item is required'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate totals for a set of quote items.
 * Each item total = quantity * unitPrice * (1 - discount/100)
 * Subtotal = sum of item totals
 * TaxAmount = subtotal * taxRate
 * Total = subtotal + taxAmount
 */
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

/**
 * Auto-generate a quote number as QUO-XXXX (padded with leading zeros).
 */
async function generateQuoteNumber(): Promise<string> {
  const count = await prisma.crmQuote.count();
  const nextNumber = count + 1;
  return `QUO-${String(nextNumber).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// GET: List quotes
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filters
  const status = searchParams.get('status');
  const dealId = searchParams.get('dealId');
  const search = searchParams.get('search');
  const createdById = searchParams.get('createdById');

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (status) where.status = status;
  if (dealId) where.dealId = dealId;
  if (createdById) where.createdById = createdById;

  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { deal: { title: { contains: search, mode: 'insensitive' } } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [quotes, total] = await Promise.all([
    prisma.crmQuote.findMany({
      where,
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            currency: true,
            lead: {
              select: {
                id: true,
                contactName: true,
                companyName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        items: {
          orderBy: { position: 'asc' },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.crmQuote.count({ where }),
  ]);

  return apiPaginated(quotes, page, limit, total, { request });
}, { requiredPermission: 'crm.deals.view' });

// ---------------------------------------------------------------------------
// POST: Create a quote
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }: { session: { user: { id: string } } }) => {
  const body = await request.json();
  const parsed = createQuoteSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { dealId, currency, taxRate, validUntil, notes, terms, items } = parsed.data;

  // Verify deal exists
  const deal = await prisma.crmDeal.findUnique({
    where: { id: dealId },
    select: { id: true, title: true },
  });

  if (!deal) {
    return apiError('Deal not found', ErrorCode.RESOURCE_NOT_FOUND, {
      status: 404,
      request,
    });
  }

  // Calculate totals
  const { itemTotals, subtotal, taxAmount, total } = calculateTotals(items, taxRate);

  // Generate quote number
  const number = await generateQuoteNumber();

  const userId = session.user.id;

  try {
    const quote = await prisma.crmQuote.create({
      data: {
        number,
        dealId,
        status: 'DRAFT',
        currency,
        subtotal,
        taxRate,
        taxAmount,
        discount: 0,
        total,
        validUntil: validUntil ? new Date(validUntil) : null,
        notes: notes || null,
        terms: terms || null,
        createdById: userId,
        items: {
          create: items.map((item, index) => ({
            productId: item.productId || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            total: itemTotals[index],
            position: item.position ?? index,
          })),
        },
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            currency: true,
            lead: {
              select: {
                id: true,
                contactName: true,
                companyName: true,
                email: true,
              },
            },
          },
        },
        items: {
          orderBy: { position: 'asc' },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    logger.info('CRM quote created', {
      event: 'crm_quote_created',
      quoteId: quote.id,
      quoteNumber: quote.number,
      dealId,
      userId,
      total: total.toString(),
    });

    return apiSuccess(quote, { status: 201, request });
  } catch (error) {
    logger.error('Failed to create CRM quote', {
      event: 'crm_quote_create_error',
      dealId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return apiError('Failed to create quote', ErrorCode.INTERNAL_ERROR, {
      status: 500,
      request,
    });
  }
}, { requiredPermission: 'crm.deals.create' });
