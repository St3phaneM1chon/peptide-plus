export const dynamic = 'force-dynamic';

/**
 * CRM Price Books API
 * GET  /api/admin/crm/price-books - List price books with entries count
 * POST /api/admin/crm/price-books - Create a price book with entries
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

const priceBookEntrySchema = z.object({
  productId: z.string().min(1),
  unitPrice: z.number().min(0),
  minQuantity: z.number().int().min(1).default(1),
  maxQuantity: z.number().int().min(1).optional(),
  discount: z.number().min(0).max(100).optional(),
  isActive: z.boolean().default(true),
});

const createPriceBookSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  type: z.enum(['STANDARD', 'CUSTOM', 'VOLUME', 'PROMOTIONAL']).default('STANDARD'),
  currency: z.string().min(3).max(3).default('CAD'),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  entries: z.array(priceBookEntrySchema).default([]),
});

// ---------------------------------------------------------------------------
// GET: List price books with entries count
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const isActive = searchParams.get('isActive');
  const type = searchParams.get('type');
  const search = searchParams.get('search');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true';
  }
  if (type) {
    where.type = type;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [priceBooks, total] = await Promise.all([
    prisma.priceBook.findMany({
      where,
      include: {
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.priceBook.count({ where }),
  ]);

  return apiPaginated(priceBooks, page, limit, total, { request });
}, { requiredPermission: 'crm.deals.view' });

// ---------------------------------------------------------------------------
// POST: Create a price book with entries
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = createPriceBookSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { name, description, type, currency, isDefault, isActive, validFrom, validUntil, entries } = parsed.data;

  // If setting as default, unset other defaults
  if (isDefault) {
    await prisma.priceBook.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const priceBook = await prisma.priceBook.create({
    data: {
      name,
      description: description || null,
      type: type as 'STANDARD' | 'CUSTOM' | 'VOLUME' | 'PROMOTIONAL',
      currency,
      isDefault,
      isActive,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      entries: {
        create: entries.map((entry) => ({
          productId: entry.productId,
          unitPrice: entry.unitPrice,
          minQuantity: entry.minQuantity,
          maxQuantity: entry.maxQuantity ?? null,
          discount: entry.discount ?? null,
          isActive: entry.isActive,
        })),
      },
    },
    include: {
      _count: { select: { entries: true } },
    },
  });

  logger.info('Price book created', {
    event: 'price_book_created',
    priceBookId: priceBook.id,
    userId: session.user.id,
    entriesCount: entries.length,
  });

  return apiSuccess(priceBook, { status: 201, request });
}, { requiredPermission: 'crm.deals.edit' });
