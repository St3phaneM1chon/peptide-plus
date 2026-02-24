export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { enqueue } from '@/lib/translation';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const createFormatSchema = z.object({
  formatType: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional().nullable(),
  dosageMg: z.number().positive().optional().nullable(),
  volumeMl: z.number().positive().optional().nullable(),
  unitCount: z.number().int().positive().optional().nullable(),
  costPrice: z.number().min(0).optional().nullable(),
  price: z.number().min(0, 'Price is required'),
  comparePrice: z.number().min(0).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  availability: z.string().optional(),
  availableDate: z.string().optional().nullable(),
  weightGrams: z.number().min(0).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET all formats for a product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formats = await prisma.productFormat.findMany({
      where: { productId: id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(formats);
  } catch (error) {
    logger.error('Error fetching formats', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch formats' },
      { status: 500 }
    );
  }
}

// POST create new format for a product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/products/formats');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { id } = await params;
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createFormatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const {
      formatType,
      name,
      description,
      imageUrl,
      dosageMg,
      volumeMl,
      unitCount,
      costPrice,
      price,
      comparePrice,
      sku,
      barcode,
      stockQuantity,
      lowStockThreshold,
      availability,
      availableDate,
      weightGrams,
      isDefault,
      isActive,
    } = parsed.data;

    // FIX: BUG-043 - Warn when creating inactive format (isActive explicitly false)
    const warningMessage = isActive === false
      ? 'Format created but marked as inactive — it will not be visible to customers.'
      : undefined;

    // BUG-044 FIX: Wrap default toggle + create in transaction to prevent race condition
    const format = await prisma.$transaction(async (tx) => {
      // If this is set as default, unset other defaults
      if (isDefault) {
        await tx.productFormat.updateMany({
          where: { productId: id },
          data: { isDefault: false },
        });
      }

      // Get max sortOrder
      const maxSort = await tx.productFormat.aggregate({
        where: { productId: id },
        _max: { sortOrder: true },
      });

      return tx.productFormat.create({
        data: {
          productId: id,
          formatType,
          name,
          description,
          imageUrl,
          dosageMg,
          volumeMl,
          unitCount,
          costPrice,
          price,
          comparePrice,
          sku,
          barcode,
          stockQuantity: stockQuantity ?? 0,
          lowStockThreshold: lowStockThreshold ?? 10,
          inStock: (stockQuantity ?? 0) > 0,
          availability: availability ?? 'IN_STOCK',
          availableDate: availableDate ? new Date(availableDate) : null,
          weightGrams,
          isDefault: isDefault ?? false,
          isActive: isActive ?? true,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
      });
    });

    // Auto-enqueue translation for all 21 locales
    enqueue.productFormat(format.id);

    // FIX: BUG-043 - Include warning in response if format was created inactive
    return NextResponse.json({ ...format, ...(warningMessage ? { warning: warningMessage } : {}) }, { status: 201 });
  } catch (error) {
    logger.error('Error creating format', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create format' },
      { status: 500 }
    );
  }
}
