export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { enqueue } from '@/lib/translation';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { createOptionSchema } from '@/lib/validations/option';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { getClientIpFromRequest } from '@/lib/admin-audit';

// GET all options for a product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const options = await prisma.productOption.findMany({
      where: { productId: id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        productId: true,
        optionType: true,
        name: true,
        description: true,
        imageUrl: true,
        price: true,
        comparePrice: true,
        dosageMg: true,
        volumeMl: true,
        unitCount: true,
        weightGrams: true,
        sku: true,
        barcode: true,
        stockQuantity: true,
        inStock: true,
        availability: true,
        availableDate: true,
        isDefault: true,
        isActive: true,
        sortOrder: true,
        trackInventory: true,
        lowStockThreshold: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess(options);
  } catch (error) {
    logger.error('Error fetching options', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch options', ErrorCode.INTERNAL_ERROR);
  }
}

// POST create new format for a product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/products/options');
    if (!rl.success) { const res = apiError('Too many requests', ErrorCode.RATE_LIMITED); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return apiError('Invalid CSRF token', ErrorCode.FORBIDDEN);
    }

    const { id } = await params;
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return apiError('Unauthorized', ErrorCode.UNAUTHORIZED);
    }

    const body = await request.json();
    const parsed = createOptionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid data', ErrorCode.VALIDATION_ERROR);
    }
    const {
      optionType,
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

    if (isActive === false) {
      logger.warn('Inactive format created', { productId: id, optionName: name });
    }

    // BUG-044 FIX: Wrap default toggle + create in transaction to prevent race condition
    const format = await prisma.$transaction(async (tx) => {
      // If this is set as default, unset other defaults
      if (isDefault) {
        await tx.productOption.updateMany({
          where: { productId: id },
          data: { isDefault: false },
        });
      }

      // Get max sortOrder
      const maxSort = await tx.productOption.aggregate({
        where: { productId: id },
        _max: { sortOrder: true },
      });

      return tx.productOption.create({
        data: {
          productId: id,
          optionType,
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
          availability: (availability ?? 'IN_STOCK') as import('@prisma/client').StockStatus,
          availableDate: availableDate ? new Date(availableDate) : null,
          weightGrams,
          isDefault: isDefault ?? false,
          isActive: isActive ?? true,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
      });
    });

    // Auto-enqueue translation for all 21 locales
    enqueue.productOption(format.id);

    // Revalidate cached pages after format creation
    try { revalidatePath('/shop', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath('/api/products', 'layout'); } catch { /* revalidation is best-effort */ }

    // FIX: BUG-043 - Include warning in response if format was created inactive
    return apiSuccess({ ...format, ...(warningMessage ? { warning: warningMessage } : {}) }, { status: 201 });
  } catch (error) {
    logger.error('Error creating format', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to create format', ErrorCode.INTERNAL_ERROR);
  }
}
