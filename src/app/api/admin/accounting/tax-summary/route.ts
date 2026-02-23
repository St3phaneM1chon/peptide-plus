export const dynamic = 'force-dynamic';

/**
 * Admin Tax Summary Report API
 * GET - Summarize all taxes collected (GST/TPS, QST/TVQ, HST/TVH, PST)
 *       for a period, grouped by tax type and province
 *
 * Query params:
 *   from  - start date (YYYY-MM-DD, required)
 *   to    - end date   (YYYY-MM-DD, required)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { roundCurrency } from '@/lib/financial';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Province / tax-type mapping
// ---------------------------------------------------------------------------

const PROVINCE_NAMES: Record<string, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

/** Determine the primary tax regime for a Canadian province */
function taxRegime(province: string): string {
  const hstProvinces = new Set(['ON', 'NB', 'NL', 'NS', 'PE']);
  const qstProvinces = new Set(['QC']);
  const pstProvinces = new Set(['BC', 'MB', 'SK']);

  if (hstProvinces.has(province)) return 'HST';
  if (qstProvinces.has(province)) return 'GST+QST';
  if (pstProvinces.has(province)) return 'GST+PST';
  return 'GST'; // AB, NT, NU, YT - GST only
}

// ---------------------------------------------------------------------------
// GET /api/admin/accounting/tax-summary
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Les parametres from et to sont requis (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const startDate = new Date(from);
    const endDate = new Date(to);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide. Utiliser YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    endDate.setHours(23, 59, 59, 999);

    // ------ 1. Taxes collected from paid orders ------
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        tax: true,
        taxTps: true,
        taxTvq: true,
        taxTvh: true,
        taxPst: true,
        shippingState: true,
        shippingCountry: true,
        createdAt: true,
      },
    });

    // ------ 2. Taxes paid on supplier invoices ------
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIAL'] },
        invoiceDate: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        taxTps: true,
        taxTvq: true,
        taxOther: true,
      },
    });

    // ------ 3. Existing TaxReport records for the period ------
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const taxReports = await prisma.taxReport.findMany({
      where: {
        year: { gte: startYear, lte: endYear },
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    // ------ Aggregate by tax type ------
    let tpsCollected = 0;
    let tvqCollected = 0;
    let tvhCollected = 0;
    let pstCollected = 0;
    let totalTaxCollected = 0;

    let tpsPaid = 0;
    let tvqPaid = 0;
    let tvhPaid = 0;
    let otherTaxPaid = 0;

    for (const order of orders) {
      tpsCollected += Number(order.taxTps);
      tvqCollected += Number(order.taxTvq);
      tvhCollected += Number(order.taxTvh);
      pstCollected += Number(order.taxPst);
      totalTaxCollected += Number(order.tax);
    }

    for (const inv of supplierInvoices) {
      tpsPaid += Number(inv.taxTps);
      tvqPaid += Number(inv.taxTvq);
      otherTaxPaid += Number(inv.taxOther);
    }

    // ------ Aggregate by province ------
    const byProvince = new Map<string, {
      province: string;
      provinceName: string;
      regime: string;
      ordersCount: number;
      totalSales: number;
      tpsCollected: number;
      tvqCollected: number;
      tvhCollected: number;
      pstCollected: number;
      totalTax: number;
    }>();

    for (const order of orders) {
      // Only break down by province for Canadian orders
      const province = order.shippingCountry === 'CA'
        ? (order.shippingState || 'UNKNOWN')
        : 'INTERNATIONAL';

      if (!byProvince.has(province)) {
        byProvince.set(province, {
          province,
          provinceName: PROVINCE_NAMES[province] || (province === 'INTERNATIONAL' ? 'International' : province),
          regime: province === 'INTERNATIONAL' ? 'NONE' : taxRegime(province),
          ordersCount: 0,
          totalSales: 0,
          tpsCollected: 0,
          tvqCollected: 0,
          tvhCollected: 0,
          pstCollected: 0,
          totalTax: 0,
        });
      }

      const prov = byProvince.get(province)!;
      prov.ordersCount += 1;
      prov.totalSales += Number(order.total);
      prov.tpsCollected += Number(order.taxTps);
      prov.tvqCollected += Number(order.taxTvq);
      prov.tvhCollected += Number(order.taxTvh);
      prov.pstCollected += Number(order.taxPst);
      prov.totalTax += Number(order.tax);
    }

    // Round province values
    const provinceBreakdown = Array.from(byProvince.values())
      .map((p) => ({
        ...p,
        totalSales: roundCurrency(p.totalSales),
        tpsCollected: roundCurrency(p.tpsCollected),
        tvqCollected: roundCurrency(p.tvqCollected),
        tvhCollected: roundCurrency(p.tvhCollected),
        pstCollected: roundCurrency(p.pstCollected),
        totalTax: roundCurrency(p.totalTax),
      }))
      .sort((a, b) => b.totalTax - a.totalTax);

    // ------ Build by-type summary ------
    const byTaxType = [
      {
        taxType: 'GST/TPS',
        description: 'Goods and Services Tax / Taxe sur les produits et services',
        rate: '5%',
        collected: roundCurrency(tpsCollected),
        paid: roundCurrency(tpsPaid),
        net: roundCurrency(tpsCollected - tpsPaid),
      },
      {
        taxType: 'QST/TVQ',
        description: 'Quebec Sales Tax / Taxe de vente du Quebec',
        rate: '9.975%',
        collected: roundCurrency(tvqCollected),
        paid: roundCurrency(tvqPaid),
        net: roundCurrency(tvqCollected - tvqPaid),
      },
      {
        taxType: 'HST/TVH',
        description: 'Harmonized Sales Tax / Taxe de vente harmonisee',
        rate: '13-15%',
        collected: roundCurrency(tvhCollected),
        paid: roundCurrency(tvhPaid),
        net: roundCurrency(tvhCollected - tvhPaid),
      },
      {
        taxType: 'PST',
        description: 'Provincial Sales Tax',
        rate: '6-7%',
        collected: roundCurrency(pstCollected),
        paid: 0,
        net: roundCurrency(pstCollected),
      },
    ];

    const totalCollected = roundCurrency(tpsCollected + tvqCollected + tvhCollected + pstCollected);
    const totalPaid = roundCurrency(tpsPaid + tvqPaid + tvhPaid + otherTaxPaid);
    const netOwing = roundCurrency(totalCollected - totalPaid);

    return NextResponse.json({
      period: { from, to },
      byTaxType,
      byProvince: provinceBreakdown,
      totals: {
        collected: totalCollected,
        paid: totalPaid,
        netOwing,
        salesCount: orders.length,
        totalSales: roundCurrency(orders.reduce((s, o) => s + Number(o.total), 0)),
      },
      filedReports: taxReports.map((r) => ({
        id: r.id,
        period: r.period,
        region: r.region,
        regionCode: r.regionCode,
        year: r.year,
        month: r.month,
        status: r.status,
        netTotal: Number(r.netTotal),
        filedAt: r.filedAt,
        paidAt: r.paidAt,
        dueDate: r.dueDate,
      })),
    });
  } catch (error) {
    logger.error('Tax summary error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la generation du sommaire de taxes' },
      { status: 500 }
    );
  }
});
