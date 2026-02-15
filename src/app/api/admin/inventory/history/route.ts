export const dynamic = 'force-dynamic';

/**
 * Admin Inventory Transaction History API
 * GET - List inventory transactions with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

// GET /api/admin/inventory/history - Inventory transaction history
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const formatId = searchParams.get('formatId');
    const type = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build where clause
    const where: Record<string, unknown> = {};

    if (productId) {
      where.productId = productId;
    }

    if (formatId) {
      where.formatId = formatId;
    }

    if (type) {
      const validTypes = ['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN'];
      if (validTypes.includes(type)) {
        where.type = type;
      } else {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    // Enrich with product/format names if needed
    const productIds = [...new Set(transactions.map((t) => t.productId))];
    const formatIds = [...new Set(transactions.filter((t) => t.formatId).map((t) => t.formatId as string))];

    const [products, formats] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
      formatIds.length > 0
        ? prisma.productFormat.findMany({
            where: { id: { in: formatIds } },
            select: { id: true, name: true, sku: true },
          })
        : [],
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const formatMap = new Map(formats.map((f) => [f.id, f]));

    const enrichedTransactions = transactions.map((t) => {
      const product = productMap.get(t.productId);
      const format = t.formatId ? formatMap.get(t.formatId) : null;
      return {
        id: t.id,
        productId: t.productId,
        productName: product?.name || 'Unknown',
        productSku: product?.sku || null,
        formatId: t.formatId,
        formatName: format?.name || null,
        formatSku: format?.sku || null,
        type: t.type,
        quantity: t.quantity,
        unitCost: Number(t.unitCost),
        runningWAC: Number(t.runningWAC),
        orderId: t.orderId,
        supplierInvoiceId: t.supplierInvoiceId,
        reason: t.reason,
        createdBy: t.createdBy,
        createdAt: t.createdAt,
      };
    });

    return NextResponse.json({
      transactions: enrichedTransactions,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Admin inventory history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
