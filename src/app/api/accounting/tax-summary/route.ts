export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { roundCurrency } from '@/lib/financial';
import { logger } from '@/lib/logger';

/**
 * GET /api/accounting/tax-summary
 * Generate a tax summary for a given period
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Les paramètres from et to sont requis' },
        { status: 400 }
      );
    }

    // Parse dates as UTC to avoid timezone off-by-one errors.
    // Input format is expected as YYYY-MM-DD (ISO date).
    // We set start to beginning of day UTC and end to end of day UTC.
    const startDate = new Date(from + 'T00:00:00.000Z');
    const endDate = new Date(to + 'T23:59:59.999Z');

    // Taxes collected from paid orders
    // Safety limit to prevent unbounded queries on large datasets
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { taxTps: true, taxTvq: true, taxTvh: true, taxPst: true, total: true },
      take: 10000,
    });

    const tpsCollected = roundCurrency(orders.reduce((s, o) => s + Number(o.taxTps), 0));
    const tvqCollected = roundCurrency(orders.reduce((s, o) => s + Number(o.taxTvq), 0));
    const tvhCollected = roundCurrency(orders.reduce((s, o) => s + Number(o.taxTvh), 0));
    const pstCollected = roundCurrency(orders.reduce((s, o) => s + Number(o.taxPst), 0));
    const totalSales = roundCurrency(orders.reduce((s, o) => s + Number(o.total), 0));

    // Taxes paid from supplier invoices
    // Safety limit to prevent unbounded queries on large datasets
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIAL'] },
        invoiceDate: { gte: startDate, lte: endDate },
      },
      select: { taxTps: true, taxTvq: true },
      take: 10000,
    });

    const tpsPaid = roundCurrency(supplierInvoices.reduce((s, i) => s + Number(i.taxTps), 0));
    const tvqPaid = roundCurrency(supplierInvoices.reduce((s, i) => s + Number(i.taxTvq), 0));
    const tvhPaid = 0; // TVH is not tracked on supplier invoices separately
    const pstPaid = 0; // PST is not tracked on supplier invoices separately

    return NextResponse.json({
      period: { from, to },
      tpsCollected,
      tvqCollected,
      tvhCollected,
      pstCollected,
      tpsPaid,
      tvqPaid,
      tvhPaid,
      pstPaid,
      netTps: roundCurrency(tpsCollected - tpsPaid),
      netTvq: roundCurrency(tvqCollected - tvqPaid),
      netTvh: roundCurrency(tvhCollected - tvhPaid),
      netPst: roundCurrency(pstCollected - pstPaid),
      salesCount: orders.length,
      totalSales,
    });
  } catch (error) {
    logger.error('Tax summary error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la génération du sommaire de taxes' },
      { status: 500 }
    );
  }
});
