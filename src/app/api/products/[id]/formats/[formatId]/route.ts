export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { enqueue } from '@/lib/translation';

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
    console.error('Error fetching format:', error);
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
      trackInventory,
      availability,
      availableDate,
      discontinuedAt,
      weightGrams,
      sortOrder,
      isDefault,
      isActive,
    } = body;

    // Check if format exists
    const existingFormat = await prisma.productFormat.findUnique({
      where: { id: formatId },
    });

    if (!existingFormat || existingFormat.productId !== id) {
      return NextResponse.json({ error: 'Format not found' }, { status: 404 });
    }

    // If this is set as default, unset other defaults
    if (isDefault && !existingFormat.isDefault) {
      await prisma.productFormat.updateMany({
        where: { productId: id, id: { not: formatId } },
        data: { isDefault: false },
      });
    }

    // Calculate inStock based on stockQuantity and availability
    const newStockQuantity = stockQuantity ?? existingFormat.stockQuantity;
    const newAvailability = availability ?? existingFormat.availability;
    const inStock = newStockQuantity > 0 && newAvailability === 'IN_STOCK';

    const format = await prisma.productFormat.update({
      where: { id: formatId },
      data: {
        formatType: formatType ?? undefined,
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

    return NextResponse.json(format);
  } catch (error) {
    console.error('Error updating format:', error);
    return NextResponse.json(
      { error: 'Failed to update format' },
      { status: 500 }
    );
  }
}

// DELETE format
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; formatId: string }> }
) {
  try {
    const { id, formatId } = await params;
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if format exists
    const format = await prisma.productFormat.findUnique({
      where: { id: formatId },
    });

    if (!format || format.productId !== id) {
      return NextResponse.json({ error: 'Format not found' }, { status: 404 });
    }

    await prisma.productFormat.delete({
      where: { id: formatId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting format:', error);
    return NextResponse.json(
      { error: 'Failed to delete format' },
      { status: 500 }
    );
  }
}
