/**
 * Admin Inventory API
 * GET  - List all products with inventory info
 * POST - Receive stock (purchase)
 * PUT  - Adjust stock manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { purchaseStock, adjustStock } from '@/lib/inventory';

// GET /api/admin/inventory - List products with inventory info
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const lowStockOnly = searchParams.get('lowStock') === 'true';

    const formats = await prisma.productFormat.findMany({
      where: {
        isActive: true,
        trackInventory: true,
        ...(lowStockOnly ? {
          // Raw filter: stockQuantity <= lowStockThreshold
          // Prisma doesn't support field-to-field comparison directly,
          // so we fetch all and filter in memory
        } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: { stockQuantity: 'asc' },
    });

    // Get the latest WAC for each format
    const inventoryItems = await Promise.all(
      formats.map(async (format) => {
        const lastTransaction = await prisma.inventoryTransaction.findFirst({
          where: {
            productId: format.productId,
            formatId: format.id,
          },
          orderBy: { createdAt: 'desc' },
          select: { runningWAC: true },
        });

        return {
          formatId: format.id,
          productId: format.productId,
          productName: format.product.name,
          productSlug: format.product.slug,
          productSku: format.product.sku,
          productImageUrl: format.product.imageUrl,
          productActive: format.product.isActive,
          formatName: format.name,
          formatType: format.formatType,
          formatSku: format.sku,
          stockQuantity: format.stockQuantity,
          lowStockThreshold: format.lowStockThreshold,
          isLowStock: format.stockQuantity <= format.lowStockThreshold,
          availability: format.availability,
          wac: lastTransaction ? Number(lastTransaction.runningWAC) : 0,
          price: Number(format.price),
        };
      })
    );

    // Filter low stock in memory if requested
    const result = lowStockOnly
      ? inventoryItems.filter((item) => item.isLowStock)
      : inventoryItems;

    return NextResponse.json({
      inventory: result,
      total: result.length,
      lowStockCount: inventoryItems.filter((item) => item.isLowStock).length,
    });
  } catch (error) {
    console.error('Admin inventory GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/inventory - Receive stock (purchase)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { items, supplierInvoiceId } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.productId || !item.quantity || !item.unitCost) {
        return NextResponse.json(
          { error: 'Each item must have productId, quantity, and unitCost' },
          { status: 400 }
        );
      }
      if (item.quantity <= 0) {
        return NextResponse.json(
          { error: 'Quantity must be positive' },
          { status: 400 }
        );
      }
      if (item.unitCost < 0) {
        return NextResponse.json(
          { error: 'Unit cost cannot be negative' },
          { status: 400 }
        );
      }
    }

    await purchaseStock(
      items.map((item: any) => ({
        productId: item.productId,
        formatId: item.formatId || undefined,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })),
      supplierInvoiceId || undefined,
      session.user.id
    );

    return NextResponse.json(
      {
        success: true,
        message: `Stock received for ${items.length} item(s)`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Admin inventory POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/inventory - Adjust stock manually
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { productId, formatId, quantity, reason } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    if (quantity === undefined || quantity === null || quantity === 0) {
      return NextResponse.json(
        { error: 'quantity is required and must be non-zero' },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'reason is required for stock adjustments' },
        { status: 400 }
      );
    }

    await adjustStock(
      productId,
      formatId || null,
      quantity,
      reason,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      message: `Stock adjusted by ${quantity} for product ${productId}`,
    });
  } catch (error) {
    console.error('Admin inventory PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
