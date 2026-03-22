export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { enqueue } from '@/lib/translation';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// BUG-009 FIX: Zod validation schema for format updates
const updateOptionSchema = z.object({
  optionType: z.string().max(50).optional(),
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().max(2000).optional().nullable(),
  dosageMg: z.number().optional().nullable(),
  volumeMl: z.number().optional().nullable(),
  unitCount: z.number().int().optional().nullable(),
  costPrice: z.number().min(0).optional().nullable(),
  price: z.number().min(0).optional(),
  comparePrice: z.number().min(0).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  trackInventory: z.boolean().optional(),
  availability: z.string().max(50).optional(),
  availableDate: z.string().optional().nullable(),
  discontinuedAt: z.string().optional().nullable(),
  weightGrams: z.number().min(0).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET single format
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  try {
    const { id, optionId } = await params;
    const format = await prisma.productOption.findUnique({
      where: { id: optionId },
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
        discontinuedAt: true,
        isDefault: true,
        isActive: true,
        sortOrder: true,
        trackInventory: true,
        lowStockThreshold: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!format || format.productId !== id) {
      return apiError('Option not found', ErrorCode.NOT_FOUND);
    }

    return apiSuccess(format);
  } catch (error) {
    logger.error('Error fetching format', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch format', ErrorCode.INTERNAL_ERROR);
  }
}

// PUT update option
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  try {
    const { id, optionId } = await params;
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return apiError('Unauthorized', ErrorCode.UNAUTHORIZED, { request });
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return apiError('Invalid CSRF token', ErrorCode.FORBIDDEN, { request });
    }

    const body = await request.json();

    // BUG-009 FIX: Validate body with Zod before destructuring to prevent mass assignment
    const validation = updateOptionSchema.safeParse(body);
    if (!validation.success) {
      return apiError(validation.error.errors[0]?.message || 'Invalid format data', ErrorCode.VALIDATION_ERROR, { details: validation.error.errors, request });
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
      trackInventory,
      availability,
      availableDate,
      discontinuedAt,
      weightGrams,
      sortOrder,
      isDefault,
      isActive,
    } = validation.data;

    // Check if format exists
    const existingFormat = await prisma.productOption.findUnique({
      where: { id: optionId },
    });

    if (!existingFormat || existingFormat.productId !== id) {
      return apiError('Option not found', ErrorCode.NOT_FOUND, { request });
    }

    // BUG-044 FIX: Use transaction for atomic default toggle
    if (isDefault && !existingFormat.isDefault) {
      await prisma.$transaction([
        prisma.productOption.updateMany({
          where: { productId: id, id: { not: optionId } },
          data: { isDefault: false },
        }),
        prisma.productOption.update({
          where: { id: optionId },
          data: { isDefault: true },
        }),
      ]);
    }

    // BUG-010 FIX: Include LIMITED availability as in-stock (not just IN_STOCK)
    const newStockQuantity = stockQuantity ?? existingFormat.stockQuantity;
    const newAvailability = (availability as import('@prisma/client').StockStatus | undefined) ?? existingFormat.availability;
    const inStock = newStockQuantity > 0 && ['IN_STOCK', 'LIMITED'].includes(newAvailability);

    const format = await prisma.productOption.update({
      where: { id: optionId },
      data: {
        optionType: optionType || undefined,
        name: name ?? undefined,
        description,
        imageUrl,
        dosageMg,
        volumeMl,
        unitCount,
        costPrice,
        price: price ?? undefined,
        comparePrice,
        sku,
        barcode,
        stockQuantity: newStockQuantity,
        lowStockThreshold: lowStockThreshold ?? undefined,
        trackInventory: trackInventory ?? undefined,
        inStock,
        availability: newAvailability,
        availableDate: availableDate ? new Date(availableDate) : null,
        discontinuedAt: discontinuedAt ? new Date(discontinuedAt) : null,
        weightGrams,
        sortOrder: sortOrder ?? undefined,
        isDefault: isDefault ?? undefined,
        isActive: isActive ?? undefined,
      },
    });

    // Auto-enqueue translation (force re-translate on update)
    enqueue.productOption(optionId, true);

    // Revalidate cached pages after format update
    try { revalidatePath('/shop', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath('/api/products', 'layout'); } catch { /* revalidation is best-effort */ }

    return apiSuccess(format, { request });
  } catch (error) {
    logger.error('Error updating format', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to update format', ErrorCode.INTERNAL_ERROR, { request });
  }
}

// DELETE option
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  try {
    const { id, optionId } = await params;
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return apiError('Unauthorized', ErrorCode.UNAUTHORIZED, { request });
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return apiError('Invalid CSRF token', ErrorCode.FORBIDDEN, { request });
    }

    // Check if format exists
    const format = await prisma.productOption.findUnique({
      where: { id: optionId },
    });

    if (!format || format.productId !== id) {
      return apiError('Option not found', ErrorCode.NOT_FOUND, { request });
    }

    // BUG-018 FIX: Soft-delete instead of hard-delete to preserve OrderItem references
    await prisma.productOption.update({
      where: { id: optionId },
      data: { isActive: false, discontinuedAt: new Date() },
    });

    // Revalidate cached pages after format deletion
    try { revalidatePath('/shop', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath('/api/products', 'layout'); } catch { /* revalidation is best-effort */ }

    return apiSuccess({ success: true }, { request });
  } catch (error) {
    logger.error('Error deleting format', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to delete format', ErrorCode.INTERNAL_ERROR, { request });
  }
}
