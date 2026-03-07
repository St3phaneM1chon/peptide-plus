export const dynamic = 'force-dynamic';

/**
 * Admin Order Export CSV API
 * GET /api/admin/orders/export - Export orders as CSV
 *
 * Supports filtering by status, payment status, and date range.
 * Returns a CSV file with order details including items.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

/**
 * Escape a value for CSV (RFC 4180).
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/admin/orders/export
export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const maxRows = Math.min(
      parseInt(searchParams.get('limit') || '10000', 10),
      50000
    );

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        (where.createdAt as Record<string, unknown>).gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = toDate;
      }
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: maxRows,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        subtotal: true,
        shippingCost: true,
        discount: true,
        tax: true,
        taxTps: true,
        taxTvq: true,
        taxTvh: true,
        taxPst: true,
        total: true,
        promoCode: true,
        shippingName: true,
        shippingAddress1: true,
        shippingAddress2: true,
        shippingCity: true,
        shippingState: true,
        shippingPostal: true,
        shippingCountry: true,
        shippingPhone: true,
        carrier: true,
        trackingNumber: true,
        customerNotes: true,
        adminNotes: true,
        orderType: true,
        createdAt: true,
        user: {
          select: { name: true, email: true },
        },
        items: {
          select: {
            productName: true,
            formatName: true,
            sku: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            total: true,
          },
        },
        currency: {
          select: { code: true },
        },
      },
    });

    // CSV header
    const headers = [
      'Order Number',
      'Date',
      'Status',
      'Payment Status',
      'Payment Method',
      'Customer Name',
      'Customer Email',
      'Subtotal',
      'Shipping',
      'Discount',
      'Tax (TPS)',
      'Tax (TVQ)',
      'Tax (TVH)',
      'Tax (PST)',
      'Total',
      'Currency',
      'Promo Code',
      'Shipping Name',
      'Shipping Address',
      'City',
      'Province/State',
      'Postal Code',
      'Country',
      'Phone',
      'Carrier',
      'Tracking Number',
      'Order Type',
      'Items (SKU x Qty)',
      'Customer Notes',
      'Admin Notes',
    ];

    const rows: string[] = [headers.map(csvEscape).join(',')];

    for (const order of orders) {
      // Summarize items as "SKU1 x 2, SKU2 x 1"
      const itemsSummary = order.items
        .map((item) => {
          const name = item.sku || item.productName;
          const format = item.formatName ? ` (${item.formatName})` : '';
          return `${name}${format} x ${item.quantity}`;
        })
        .join('; ');

      const shippingAddr = [
        order.shippingAddress1,
        order.shippingAddress2,
      ].filter(Boolean).join(', ');

      const row = [
        order.orderNumber,
        order.createdAt.toISOString(),
        order.status,
        order.paymentStatus,
        order.paymentMethod || '',
        order.user?.name || order.shippingName,
        order.user?.email || '',
        Number(order.subtotal).toFixed(2),
        Number(order.shippingCost).toFixed(2),
        Number(order.discount).toFixed(2),
        Number(order.taxTps).toFixed(2),
        Number(order.taxTvq).toFixed(2),
        Number(order.taxTvh).toFixed(2),
        Number(order.taxPst).toFixed(2),
        Number(order.total).toFixed(2),
        order.currency?.code || 'CAD',
        order.promoCode || '',
        order.shippingName,
        shippingAddr,
        order.shippingCity,
        order.shippingState,
        order.shippingPostal,
        order.shippingCountry,
        order.shippingPhone || '',
        order.carrier || '',
        order.trackingNumber || '',
        order.orderType,
        itemsSummary,
        order.customerNotes || '',
        order.adminNotes || '',
      ];

      rows.push(row.map(csvEscape).join(','));
    }

    // UTF-8 BOM for Excel compatibility with French accents
    const csv = '\uFEFF' + rows.join('\n');

    // Generate filename with date
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `orders-export-${dateStr}.csv`;

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'EXPORT_ORDERS_CSV',
      targetType: 'Order',
      targetId: `export_${orders.length}`,
      newValue: {
        rowCount: orders.length,
        filters: { status, paymentStatus, from, to },
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err: unknown) => {
      logger.error('[AdminOrderExport] Non-blocking audit log failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Admin orders export error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
