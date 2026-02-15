export const dynamic = 'force-dynamic';

/**
 * API EXPORT HISTORIQUE DES COMMANDES
 * GET /api/account/orders/export - Exporte les commandes de l'utilisateur en CSV
 *
 * Query params:
 * - format: 'csv' (default)
 * - dateFrom: ISO date string (optional)
 * - dateTo: ISO date string (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { generateCSV, formatDateForCSV } from '@/lib/csv-export';

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause for date filtering
    const whereClause: {
      userId: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = {
      userId: user.id,
    };

    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        // Set to end of day
        endDate.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = endDate;
      }
    }

    // Fetch orders with items
    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          select: {
            productName: true,
            formatName: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
        currency: {
          select: { code: true },
        },
      },
    });

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'No orders found for export' },
        { status: 404 }
      );
    }

    // Build CSV data
    const headers = [
      'Order Number',
      'Date',
      'Status',
      'Payment Status',
      'Items',
      'Subtotal',
      'Tax',
      'Shipping',
      'Discount',
      'Total',
      'Currency',
      'Payment Method',
      'Tracking Number',
      'Carrier',
    ];

    const rows: string[][] = orders.map((order) => {
      // Format items as comma-separated list of product names with quantities
      const itemsList = order.items
        .map((item) => {
          const formatInfo = item.formatName ? ` (${item.formatName})` : '';
          return `${item.productName}${formatInfo} x${item.quantity}`;
        })
        .join('; ');

      const currency = order.currency?.code || 'CAD';
      const formatMoney = (amount: number | string) => Number(amount).toFixed(2);

      return [
        order.orderNumber,
        formatDateForCSV(order.createdAt),
        order.status,
        order.paymentStatus,
        itemsList,
        formatMoney(order.subtotal),
        formatMoney(order.tax),
        formatMoney(order.shippingCost),
        formatMoney(order.discount),
        formatMoney(order.total),
        currency,
        order.paymentMethod || 'N/A',
        order.trackingNumber || 'N/A',
        order.carrier || 'N/A',
      ];
    });

    // Generate CSV content
    const csvContent = generateCSV(headers, rows);

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const filename = `orders-export-${today}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export orders error:', error);
    return NextResponse.json(
      { error: 'Internal server error during export' },
      { status: 500 }
    );
  }
}
