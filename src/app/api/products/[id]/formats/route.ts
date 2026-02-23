export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { enqueue } from '@/lib/translation';
import { logger } from '@/lib/logger';

// GET all formats for a product
export async function GET(
  _request: Request,
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
    const { id } = await params;
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
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
    } = body;

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
