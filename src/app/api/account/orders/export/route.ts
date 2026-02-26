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
import { formatDateForCSV } from '@/lib/csv-export';
import { logger } from '@/lib/logger';

// P-06 FIX: Batch size for streaming export — keeps memory flat regardless of total order count.
const EXPORT_BATCH_SIZE = 100;

/**
 * Escapes a single CSV field value (quotes, commas, newlines, formula injection).
 * Duplicated here to avoid importing the full generateCSV helper, because we build
 * the CSV incrementally row-by-row inside a ReadableStream.
 */
function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Neutralise formula-injection characters (CWE-1236)
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCSVField).join(',') + '\n';
}

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

    // P-06 FIX: Stream CSV in batches of EXPORT_BATCH_SIZE rows instead of loading
    // all orders into memory at once. Azure has strict memory limits and a user with
    // thousands of orders would cause an OOM error with the old approach.
    //
    // We use a ReadableStream so the HTTP response body is written incrementally:
    // the first batch is sent to the client while the second is still being fetched,
    // and only one batch (≤100 orders) lives in RAM at any given moment.
    const today = new Date().toISOString().split('T')[0];
    const filename = `orders-export-${today}.csv`;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // UTF-8 BOM for Excel compatibility + header row
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
          controller.enqueue(encoder.encode('\uFEFF' + csvRow(headers)));

          let skip = 0;
          let totalExported = 0;

          while (true) {
            const batch = await prisma.order.findMany({
              where: whereClause,
              orderBy: { createdAt: 'desc' },
              take: EXPORT_BATCH_SIZE,
              skip,
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

            if (batch.length === 0) break;

            for (const order of batch) {
              const itemsList = order.items
                .map((item) => {
                  const formatInfo = item.formatName ? ` (${item.formatName})` : '';
                  return `${item.productName}${formatInfo} x${item.quantity}`;
                })
                .join('; ');

              const currency = order.currency?.code || 'CAD';
              const fmt = (v: number | string) => Number(v).toFixed(2);

              controller.enqueue(
                encoder.encode(
                  csvRow([
                    order.orderNumber,
                    formatDateForCSV(order.createdAt),
                    order.status,
                    order.paymentStatus,
                    itemsList,
                    fmt(Number(order.subtotal)),
                    fmt(Number(order.tax)),
                    fmt(Number(order.shippingCost)),
                    fmt(Number(order.discount)),
                    fmt(Number(order.total)),
                    currency,
                    order.paymentMethod || 'N/A',
                    order.trackingNumber || 'N/A',
                    order.carrier || 'N/A',
                  ])
                )
              );
            }

            totalExported += batch.length;
            skip += EXPORT_BATCH_SIZE;

            // If batch is smaller than the page size we've reached the last page
            if (batch.length < EXPORT_BATCH_SIZE) break;
          }

          if (totalExported === 0) {
            // Signal no data — the client receives an empty CSV (header only).
            // We cannot switch to JSON at this point because the stream has started,
            // so we close normally; the frontend can detect a header-only file.
            logger.info('Export orders: no orders found for user', { userId: user.id });
          }

          controller.close();
        } catch (err) {
          logger.error('Export orders stream error', { error: err instanceof Error ? err.message : String(err) });
          controller.error(err);
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Prevent buffering by proxies/CDN so the stream reaches the client immediately
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    logger.error('Export orders error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error during export' },
      { status: 500 }
    );
  }
}
