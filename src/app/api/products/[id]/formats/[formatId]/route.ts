export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { enqueue } from '@/lib/translation';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// BUG-009 FIX: Zod validation schema for format updates
const updateFormatSchema = z.object({
  formatType: z.string().max(50).optional(),
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
  { params }: { params: Promise<{ id: string; formatId: string }> }
) {
  try {
    const { id, formatId } = await params;
    const format = await prisma.productFormat.findUnique({
      where: { id: formatId },
    });

    if (!format || format.productId !== id) {
      return NextResponse.json({ error: 'Format not found' }, { status: 404 });
    }

    return NextResponse.json(format);
  } catch (error) {
    logger.error('Error fetching format', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch format' },
      { status: 500 }
    );
  }
}

// PUT update format
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; formatId: string }> }
) {
  try {
    const { id, formatId } = await params;
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();

    // BUG-009 FIX: Validate body with Zod before destructuring to prevent mass assignment
    const validation = updateFormatSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid format data', details: validation.error.errors },
        { status: 400 }
      );
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
    const existingFormat = await prisma.productFormat.findUnique({
      where: { id: formatId },
    });

    if (!existingFormat || existingFormat.productId !== id) {
      return NextResponse.json({ error: 'Format not found' }, { status: 404 });
    }

    // BUG-044 FIX: Use transaction for atomic default toggle
    if (isDefault && !existingFormat.isDefault) {
      await prisma.$transaction([
        prisma.productFormat.updateMany({
          where: { productId: id, id: { not: formatId } },
          data: { isDefault: false },
        }),
        prisma.productFormat.update({
          where: { id: formatId },
          data: { isDefault: true },
        }),
      ]);
    }

    // BUG-010 FIX: Include LIMITED availability as in-stock (not just IN_STOCK)
    const newStockQuantity = stockQuantity ?? existingFormat.stockQuantity;
    const newAvailability = (availability as import('@prisma/client').StockStatus | undefined) ?? existingFormat.availability;
    const inStock = newStockQuantity > 0 && ['IN_STOCK', 'LIMITED'].includes(newAvailability);

    const format = await prisma.productFormat.update({
      where: { id: formatId },
      data: {
        formatType: formatType ? (formatType as import('@prisma/client').FormatType) : undefined,
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
    enqueue.productFormat(formatId, true);

    // Revalidate cached pages after format update
    try { revalidatePath('/shop', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath('/api/products', 'layout'); } catch { /* revalidation is best-effort */ }

    return NextResponse.json(format);
  } catch (error) {
    logger.error('Error updating format', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to update format' },
      { status: 500 }
    );
  }
}

// DELETE format
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; formatId: string }> }
) {
  try {
    const { id, formatId } = await params;
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Check if format exists
    const format = await prisma.productFormat.findUnique({
      where: { id: formatId },
    });

    if (!format || format.productId !== id) {
      return NextResponse.json({ error: 'Format not found' }, { status: 404 });
    }

    // BUG-018 FIX: Soft-delete instead of hard-delete to preserve OrderItem references
    await prisma.productFormat.update({
      where: { id: formatId },
      data: { isActive: false, discontinuedAt: new Date() },
    });

    // Revalidate cached pages after format deletion
    try { revalidatePath('/shop', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath('/api/products', 'layout'); } catch { /* revalidation is best-effort */ }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting format', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete format' },
      { status: 500 }
    );
  }
}
