export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/tax-summary
 * Generate a tax summary for a given period
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Les paramètres from et to sont requis' },
        { status: 400 }
      );
    }

    const startDate = new Date(from);
    const endDate = new Date(to);

    // Taxes collected from paid orders
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { taxTps: true, taxTvq: true, taxTvh: true, total: true },
    });

    const tpsCollected = orders.reduce((s, o) => s + Number(o.taxTps), 0);
    const tvqCollected = orders.reduce((s, o) => s + Number(o.taxTvq), 0);
    const tvhCollected = orders.reduce((s, o) => s + Number(o.taxTvh), 0);
    const totalSales = orders.reduce((s, o) => s + Number(o.total), 0);

    // Taxes paid from supplier invoices
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIAL'] },
        invoiceDate: { gte: startDate, lte: endDate },
      },
      select: { taxTps: true, taxTvq: true },
    });

    const tpsPaid = supplierInvoices.reduce((s, i) => s + Number(i.taxTps), 0);
    const tvqPaid = supplierInvoices.reduce((s, i) => s + Number(i.taxTvq), 0);
    const tvhPaid = 0; // TVH is not tracked on supplier invoices separately

    return NextResponse.json({
      period: { from, to },
      tpsCollected: Math.round(tpsCollected * 100) / 100,
      tvqCollected: Math.round(tvqCollected * 100) / 100,
      tvhCollected: Math.round(tvhCollected * 100) / 100,
      tpsPaid: Math.round(tpsPaid * 100) / 100,
      tvqPaid: Math.round(tvqPaid * 100) / 100,
      tvhPaid: Math.round(tvhPaid * 100) / 100,
      netTps: Math.round((tpsCollected - tpsPaid) * 100) / 100,
      netTvq: Math.round((tvqCollected - tvqPaid) * 100) / 100,
      netTvh: Math.round((tvhCollected - tvhPaid) * 100) / 100,
      salesCount: orders.length,
      totalSales: Math.round(totalSales * 100) / 100,
    });
  } catch (error) {
    console.error('Tax summary error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du sommaire de taxes' },
      { status: 500 }
    );
  }
}
