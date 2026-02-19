export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';
import { roundCurrency } from '@/lib/financial';
import { createHash } from 'crypto';

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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);

    const where: Record<string, unknown> = {};
    if (year) where.year = parseInt(year);
    if (status) where.status = status;
    if (regionCode) where.regionCode = regionCode;

    const [reports, total] = await Promise.all([
      prisma.taxReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.taxReport.count({ where }),
    ]);

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

    return NextResponse.json({
      reports: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
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

    // #40 Check for duplicate reports (same period+year+regionCode)
    const duplicateWhere: Record<string, unknown> = {
      year,
      regionCode,
    };
    if (periodType === 'MONTHLY' && month) {
      duplicateWhere.month = month;
      duplicateWhere.periodType = 'MONTHLY';
    } else if (periodType === 'QUARTERLY' && quarter) {
      duplicateWhere.quarter = quarter;
      duplicateWhere.periodType = 'QUARTERLY';
    } else {
      duplicateWhere.periodType = 'ANNUAL';
    }
    const existingReport = await prisma.taxReport.findFirst({ where: duplicateWhere });
    if (existingReport) {
      return NextResponse.json(
        { error: `Un rapport de taxes existe déjà pour cette période (${period}, ${regionCode}, ${year})`, existingReportId: existingReport.id },
        { status: 409 }
      );
    }

    // Determine date range for the period using UTC to avoid timezone
    // off-by-one errors. Business operates in Eastern Time (America/Toronto)
    // but DB timestamps are in UTC, so we use UTC boundaries.
    let startDate: Date;
    let endDate: Date;

    if (periodType === 'MONTHLY' && month) {
      // First day of month at 00:00 UTC
      startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      // Last day of month at 23:59:59.999 UTC
      endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    } else if (periodType === 'QUARTERLY' && quarter) {
      const startMonth = (quarter - 1) * 3;
      startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
    } else {
      startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    }

    // Calculate taxes collected from paid orders
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { taxTps: true, taxTvq: true, taxTvh: true, total: true },
    });

    const tpsCollected = roundCurrency(orders.reduce((s, o) => s + Number(o.taxTps), 0));
    const tvqCollected = roundCurrency(orders.reduce((s, o) => s + Number(o.taxTvq), 0));
    const tvhCollected = roundCurrency(orders.reduce((s, o) => s + Number(o.taxTvh), 0));
    const totalSales = roundCurrency(orders.reduce((s, o) => s + Number(o.total), 0));

    // Calculate taxes paid from supplier invoices
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIAL'] },
        invoiceDate: { gte: startDate, lte: endDate },
      },
      select: { taxTps: true, taxTvq: true },
    });

    const tpsPaid = roundCurrency(supplierInvoices.reduce((s, i) => s + Number(i.taxTps), 0));
    const tvqPaid = roundCurrency(supplierInvoices.reduce((s, i) => s + Number(i.taxTvq), 0));

    const netTps = roundCurrency(tpsCollected - tpsPaid);
    const netTvq = roundCurrency(tvqCollected - tvqPaid);
    const netTvh = tvhCollected;
    const netTotal = roundCurrency(netTps + netTvq + netTvh);

    // Calculate due date (typically last day of the month following the period)
    const dueDate = new Date(endDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
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

    const validStatuses = ['DRAFT', 'GENERATED', 'FILED', 'PAID'];
    const updateData: Record<string, unknown> = {};
    if (status) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Statut invalide. Valeurs acceptées: ${validStatuses.join(', ')}` }, { status: 400 });
      }
      updateData.status = status;
      if (status === 'FILED') {
        updateData.filedAt = new Date();
        // #77 Compliance: Generate SHA-256 integrity hash when filing tax report
        // This hash covers all financial figures to detect post-filing tampering.
        const hashPayload = JSON.stringify({
          id: existing.id,
          period: existing.period,
          year: existing.year,
          regionCode: existing.regionCode,
          tpsCollected: existing.tpsCollected.toString(),
          tvqCollected: existing.tvqCollected.toString(),
          tvhCollected: existing.tvhCollected.toString(),
          tpsPaid: existing.tpsPaid.toString(),
          tvqPaid: existing.tvqPaid.toString(),
          netTps: existing.netTps.toString(),
          netTvq: existing.netTvq.toString(),
          netTvh: existing.netTvh.toString(),
          netTotal: existing.netTotal.toString(),
          totalSales: existing.totalSales.toString(),
          salesCount: existing.salesCount,
        });
        updateData.notes = JSON.stringify({
          ...(existing.notes ? JSON.parse(existing.notes as string) : {}),
          integrityHash: createHash('sha256').update(hashPayload).digest('hex'),
          hashGeneratedAt: new Date().toISOString(),
        });
      }
    }
    if (filingNumber) updateData.filingNumber = filingNumber;
    if (paidAt) updateData.paidAt = new Date(paidAt);

    const report = await prisma.taxReport.update({
      where: { id },
      data: updateData,
    });

    // #77 Compliance: Verify integrity hash on reads for FILED reports
    let integrityValid: boolean | null = null;
    if (report.status === 'FILED' && report.notes) {
      try {
        const notesData = JSON.parse(report.notes as string);
        if (notesData.integrityHash) {
          const verifyPayload = JSON.stringify({
            id: report.id,
            period: report.period,
            year: report.year,
            regionCode: report.regionCode,
            tpsCollected: report.tpsCollected.toString(),
            tvqCollected: report.tvqCollected.toString(),
            tvhCollected: report.tvhCollected.toString(),
            tpsPaid: report.tpsPaid.toString(),
            tvqPaid: report.tvqPaid.toString(),
            netTps: report.netTps.toString(),
            netTvq: report.netTvq.toString(),
            netTvh: report.netTvh.toString(),
            netTotal: report.netTotal.toString(),
            totalSales: report.totalSales.toString(),
            salesCount: report.salesCount,
          });
          const currentHash = createHash('sha256').update(verifyPayload).digest('hex');
          integrityValid = currentHash === notesData.integrityHash;
        }
      } catch {
        integrityValid = null;
      }
    }

    return NextResponse.json({ success: true, report, integrityValid });
  } catch (error) {
    console.error('Update tax report error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du rapport de taxes' },
      { status: 500 }
    );
  }
}
