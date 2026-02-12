import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/tax-reports
 * List tax reports with filters
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
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const regionCode = searchParams.get('regionCode');

    const where: Record<string, unknown> = {};
    if (year) where.year = parseInt(year);
    if (status) where.status = status;
    if (regionCode) where.regionCode = regionCode;

    const reports = await prisma.taxReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const mapped = reports.map((r) => ({
      ...r,
      tpsCollected: Number(r.tpsCollected),
      tvqCollected: Number(r.tvqCollected),
      tvhCollected: Number(r.tvhCollected),
      otherTaxCollected: Number(r.otherTaxCollected),
      tpsPaid: Number(r.tpsPaid),
      tvqPaid: Number(r.tvqPaid),
      tvhPaid: Number(r.tvhPaid),
      otherTaxPaid: Number(r.otherTaxPaid),
      netTps: Number(r.netTps),
      netTvq: Number(r.netTvq),
      netTvh: Number(r.netTvh),
      netTotal: Number(r.netTotal),
      totalSales: Number(r.totalSales),
    }));

    return NextResponse.json({ reports: mapped });
  } catch (error) {
    console.error('Get tax reports error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des rapports de taxes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/tax-reports
 * Generate a new tax report from journal data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { period, periodType, year, month, quarter, regionCode } = body;

    if (!period || !periodType || !year || !regionCode) {
      return NextResponse.json(
        { error: 'period, periodType, year et regionCode sont requis' },
        { status: 400 }
      );
    }

    // Determine date range for the period
    let startDate: Date;
    let endDate: Date;

    if (periodType === 'MONTHLY' && month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else if (periodType === 'QUARTERLY' && quarter) {
      const startMonth = (quarter - 1) * 3;
      startDate = new Date(year, startMonth, 1);
      endDate = new Date(year, startMonth + 3, 0, 23, 59, 59);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    // Calculate taxes collected from paid orders
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

    // Calculate taxes paid from supplier invoices
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIAL'] },
        invoiceDate: { gte: startDate, lte: endDate },
      },
      select: { taxTps: true, taxTvq: true },
    });

    const tpsPaid = supplierInvoices.reduce((s, i) => s + Number(i.taxTps), 0);
    const tvqPaid = supplierInvoices.reduce((s, i) => s + Number(i.taxTvq), 0);

    const netTps = tpsCollected - tpsPaid;
    const netTvq = tvqCollected - tvqPaid;
    const netTvh = tvhCollected;
    const netTotal = netTps + netTvq + netTvh;

    // Calculate due date (typically last day of the month following the period)
    const dueDate = new Date(endDate);
    dueDate.setMonth(dueDate.getMonth() + 2);
    dueDate.setDate(0); // Last day of next month

    // Map regionCode to region name
    const regionMap: Record<string, string> = {
      QC: 'Québec', ON: 'Ontario', BC: 'Colombie-Britannique',
      AB: 'Alberta', SK: 'Saskatchewan', MB: 'Manitoba',
      NS: 'Nouvelle-Écosse', NB: 'Nouveau-Brunswick',
      NL: 'Terre-Neuve-et-Labrador', PE: 'Île-du-Prince-Édouard',
    };

    const report = await prisma.taxReport.create({
      data: {
        period,
        periodType,
        year,
        month: month || null,
        quarter: quarter || null,
        region: regionMap[regionCode] || regionCode,
        regionCode,
        tpsCollected,
        tvqCollected,
        tvhCollected,
        tpsPaid,
        tvqPaid,
        netTps,
        netTvq,
        netTvh,
        netTotal,
        salesCount: orders.length,
        totalSales,
        status: 'GENERATED',
        dueDate,
      },
    });

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error) {
    console.error('Generate tax report error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport de taxes' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/tax-reports
 * Update tax report status
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, filingNumber, paidAt } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.taxReport.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rapport non trouvé' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === 'FILED') updateData.filedAt = new Date();
    }
    if (filingNumber) updateData.filingNumber = filingNumber;
    if (paidAt) updateData.paidAt = new Date(paidAt);

    const report = await prisma.taxReport.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Update tax report error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du rapport de taxes' },
      { status: 500 }
    );
  }
}
