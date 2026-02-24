export const dynamic = 'force-dynamic';
/**
 * API - List user invoices (paid orders)
 * GET /api/account/invoices
 * Supports: ?page=1&limit=10&from=2025-01-01&to=2025-12-31
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build date range filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: Record<string, any> = {};
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        dateFilter.gte = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
    }

    const where = {
      userId: session.user.id,
      paymentStatus: 'PAID',
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    };

    // Get total count for pagination
    const total = await prisma.order.count({ where });

    // Fetch paginated orders with items
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          select: {
            id: true,
            productName: true,
            formatName: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
        currency: {
          select: {
            code: true,
            symbol: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Convert Decimal fields to Number
    const invoices = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      invoiceNumber: `INV-${order.orderNumber}`,
      date: order.createdAt.toISOString(),
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      discount: Number(order.discount),
      taxTps: Number(order.taxTps),
      taxTvq: Number(order.taxTvq),
      taxTvh: Number(order.taxTvh),
      taxPst: Number(order.taxPst),
      total: Number(order.total),
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      currency: order.currency ? {
        code: order.currency.code,
        symbol: order.currency.symbol,
      } : { code: 'CAD', symbol: '$' },
      itemCount: order.items.length,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        formatName: item.formatName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
    }));

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching invoices', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}
