export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

// GET all formats for a product
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formats = await prisma.productFormat.findMany({
      where: { productId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(formats);
  } catch (error) {
    console.error('Error fetching formats:', error);
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

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.productFormat.updateMany({
        where: { productId: id },
        data: { isDefault: false },
      });
    }

    // Get max sortOrder
    const maxSort = await prisma.productFormat.aggregate({
      where: { productId: id },
      _max: { sortOrder: true },
    });

    const format = await prisma.productFormat.create({
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

    return NextResponse.json(format, { status: 201 });
  } catch (error) {
    console.error('Error creating format:', error);
    return NextResponse.json(
      { error: 'Failed to create format' },
      { status: 500 }
    );
  }
}
