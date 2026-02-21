export const dynamic = 'force-dynamic';

/**
 * Admin Inventory Item API
 * PATCH - Update stock quantity for a specific product format
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

// PATCH /api/admin/inventory/[id] - Update stock for a product format
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const formatId = params!.id;
    const body = await request.json();
    const { stockQuantity, reason } = body;

    if (stockQuantity === undefined || stockQuantity === null) {
      return NextResponse.json(
        { error: 'stockQuantity is required' },
        { status: 400 }
      );
    }

    if (typeof stockQuantity !== 'number' || stockQuantity < 0) {
      return NextResponse.json(
        { error: 'stockQuantity must be a non-negative number' },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'reason is required for stock adjustments' },
        { status: 400 }
      );
    }

    // Find the format
    const format = await prisma.productFormat.findUnique({
      where: { id: formatId },
    });

    if (!format) {
      return NextResponse.json(
        { error: 'Product format not found' },
        { status: 404 }
      );
    }

    const oldQuantity = format.stockQuantity;
    const adjustment = stockQuantity - oldQuantity;

    if (adjustment === 0) {
      return NextResponse.json({
        success: true,
        message: 'No change in stock quantity',
      });
    }

    // Get current WAC for the inventory transaction
    const lastTransaction = await prisma.inventoryTransaction.findFirst({
      where: {
        productId: format.productId,
        formatId: format.id,
      },
      orderBy: { createdAt: 'desc' },
      select: { runningWAC: true },
    });
    const wac = lastTransaction ? Number(lastTransaction.runningWAC) : 0;

    // Update the stock quantity
    const updatedFormat = await prisma.productFormat.update({
      where: { id: formatId },
      data: {
        stockQuantity,
        availability: stockQuantity === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK',
      },
    });

    // Create inventory transaction record
    await prisma.inventoryTransaction.create({
      data: {
        productId: format.productId,
        formatId: format.id,
        type: 'ADJUSTMENT',
        quantity: adjustment,
        unitCost: wac,
        runningWAC: wac,
        reason: reason,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      format: {
        id: updatedFormat.id,
        stockQuantity: updatedFormat.stockQuantity,
        availability: updatedFormat.availability,
      },
    });
  } catch (error) {
    console.error('Admin inventory PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
