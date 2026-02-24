export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { PROVINCIAL_TAX_RATES } from '@/lib/accounting/canadian-tax-config';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod schema for POST
// ---------------------------------------------------------------------------
const gstQstDeclarationSchema = z.object({
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
  method: z.enum(['regular', 'quick']).optional().default('regular'),
  province: z.string().optional().default('QC'),
  status: z.enum(['DRAFT', 'GENERATED', 'FILED']).optional(),
  data: z.record(z.unknown()),
});

// FIX: F006 - Shared due date calculation used by both GET and POST
// GST/QST filing deadline: last day of the month following the reporting period end
// (i.e. +1 month then set day=0 to get last day of that month)
function calculateGstQstDueDate(periodEndDate: Date): Date {
  const dueDate = new Date(periodEndDate);
  dueDate.setMonth(dueDate.getMonth() + 2);
  dueDate.setDate(0); // Last day of previous month = last day of month after period end
  return dueDate;
}

// ---------------------------------------------------------------------------
// Quick Method rates by province (services sector)
// These are the remittance rates used when a business elects the Quick Method
// for calculating GST/QST. The credit threshold is $30,000.
// ---------------------------------------------------------------------------
const QUICK_METHOD_RATES: Record<string, { gst: number; qst: number }> = {
  QC: { gst: 3.6, qst: 6.6 },
  ON: { gst: 8.8, qst: 0 },   // HST province - combined rate
  AB: { gst: 3.6, qst: 0 },
  BC: { gst: 3.6, qst: 0 },
  SK: { gst: 3.6, qst: 0 },
  MB: { gst: 3.6, qst: 0 },
  NB: { gst: 8.8, qst: 0 },   // HST province
  NL: { gst: 8.8, qst: 0 },   // HST province
  NS: { gst: 8.8, qst: 0 },   // HST province
  PE: { gst: 8.8, qst: 0 },   // HST province
  YT: { gst: 3.6, qst: 0 },
  NT: { gst: 3.6, qst: 0 },
  NU: { gst: 3.6, qst: 0 },
};

// FIX: F066 - The Quick Method is only available if annual taxable supplies (including GST/HST)
// are $400,000 or less. The $30K threshold below is for the 1% credit on first $30K of supplies.
// TODO: Add validation that the business qualifies for Quick Method (annual revenue <= $400K)
// before allowing method='quick'. Currently no annual revenue check is performed.
const QUICK_METHOD_CREDIT_THRESHOLD = 30000;
const QUICK_METHOD_CREDIT_RATE_GST = 1; // 1% credit on first $30K

// ---------------------------------------------------------------------------
// Helper: round to 2 decimal places
// ---------------------------------------------------------------------------
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// GET /api/accounting/gst-qst-declaration
// Generate GST/QST declaration data for a given period.
//
// Query params:
//   - startDate (ISO string, required)
//   - endDate   (ISO string, required)
//   - method    ('regular' | 'quick', default: 'regular')
//   - province  (two-letter code, default: 'QC')
// ---------------------------------------------------------------------------
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const method = (searchParams.get('method') || 'regular') as 'regular' | 'quick';
    const province = (searchParams.get('province') || 'QC').toUpperCase();

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: 'startDate et endDate sont requis (format ISO: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide. Utilisez le format ISO (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'startDate doit etre anterieur a endDate' },
        { status: 400 }
      );
    }

    // Ensure endDate covers the full day
    endDate.setHours(23, 59, 59, 999);

    // -----------------------------------------------------------------------
    // 1. Fetch tax-related journal lines for the period
    //    Account codes:
    //      1400 = GST Receivable (ITC)
    //      1410 = QST Receivable (ITR)
    //      2020 = GST Payable (collected)
    //      2030 = QST Payable (collected)
    // -----------------------------------------------------------------------
    const taxAccountCodes = ['1400', '1410', '2020', '2030'];

    // FIX: F084 - TODO: Replace findMany+take:50000 with aggregate SQL to avoid OOM on large datasets
    const journalLines = await prisma.journalLine.findMany({
      where: {
        entry: {
          status: 'POSTED',
          date: { gte: startDate, lte: endDate },
        },
        account: {
          code: { in: taxAccountCodes },
        },
      },
      include: {
        account: { select: { code: true, name: true } },
      },
      take: 50000,
    });

    // Aggregate by account code
    const totals: Record<string, { debit: number; credit: number }> = {};
    for (const code of taxAccountCodes) {
      totals[code] = { debit: 0, credit: 0 };
    }
    for (const line of journalLines) {
      const code = line.account.code;
      if (totals[code]) {
        totals[code].debit += Number(line.debit);
        totals[code].credit += Number(line.credit);
      }
    }

    // GST collected = credits on account 2020 (liability increases = credits)
    const gstCollected = round2(totals['2020'].credit - totals['2020'].debit);
    // QST collected = credits on account 2030
    const qstCollected = round2(totals['2030'].credit - totals['2030'].debit);
    // ITC (GST paid on purchases) = debits on account 1400 (asset increases = debits)
    const itc = round2(totals['1400'].debit - totals['1400'].credit);
    // ITR (QST paid on purchases) = debits on account 1410
    const itr = round2(totals['1410'].debit - totals['1410'].credit);

    // -----------------------------------------------------------------------
    // 2. Fetch customer invoices for supplies breakdown
    // -----------------------------------------------------------------------
    const customerInvoices = await prisma.customerInvoice.findMany({
      where: {
        invoiceDate: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
        deletedAt: null,
      },
      select: {
        subtotal: true,
        taxTps: true,
        taxTvq: true,
        taxTvh: true,
        total: true,
      },
      take: 50000,
    });

    // Calculate supplies breakdown
    let taxableSupplies = 0;
    let zeroRatedSupplies = 0;
    let exemptSupplies = 0;

    for (const inv of customerInvoices) {
      const sub = Number(inv.subtotal);
      const hasTax = Number(inv.taxTps) > 0 || Number(inv.taxTvq) > 0 || Number(inv.taxTvh) > 0;

      if (hasTax) {
        taxableSupplies += sub;
      } else {
        // Distinguish zero-rated vs exempt: zero-rated still entitle to ITC
        // For simplicity, invoices with zero tax are classified as zero-rated
        zeroRatedSupplies += sub;
      }
    }

    taxableSupplies = round2(taxableSupplies);
    zeroRatedSupplies = round2(zeroRatedSupplies);
    exemptSupplies = round2(exemptSupplies);
    const totalSupplies = round2(taxableSupplies + zeroRatedSupplies + exemptSupplies);

    // -----------------------------------------------------------------------
    // 3. Fetch supplier invoices for verification
    // -----------------------------------------------------------------------
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        invoiceDate: { gte: startDate, lte: endDate },
        status: { in: ['PAID', 'PARTIAL', 'SENT'] },
        deletedAt: null,
      },
      select: {
        subtotal: true,
        taxTps: true,
        taxTvq: true,
        total: true,
      },
      take: 50000,
    });

    const supplierTpsTotal = round2(supplierInvoices.reduce((s, i) => s + Number(i.taxTps), 0));
    const supplierTvqTotal = round2(supplierInvoices.reduce((s, i) => s + Number(i.taxTvq), 0));

    // -----------------------------------------------------------------------
    // 4. Calculate net amounts (regular method)
    // -----------------------------------------------------------------------
    const netGst = round2(gstCollected - itc);
    const netQst = round2(qstCollected - itr);
    const totalRemittance = round2(netGst + netQst);

    // -----------------------------------------------------------------------
    // 5. Quick Method calculation (if requested)
    // -----------------------------------------------------------------------
    let quickMethodData: {
      revenue: number;
      gstRate: number;
      qstRate: number;
      gstRemittance: number;
      qstRemittance: number;
      totalRemittance: number;
      creditThreshold: number;
      gstCredit: number;
    } | null = null;

    if (method === 'quick') {
      const qmRates = QUICK_METHOD_RATES[province] || QUICK_METHOD_RATES['QC'];
      const provinceTax = PROVINCIAL_TAX_RATES.find(p => p.provinceCode === province);

      // Total revenue including taxes
      const totalRevenueWithTax = round2(
        customerInvoices.reduce((s, inv) => s + Number(inv.total), 0)
      );

      // Apply quick method rate
      const gstRemittance = round2(totalRevenueWithTax * (qmRates.gst / 100));
      const qstRemittance = round2(totalRevenueWithTax * (qmRates.qst / 100));

      // Credit on first $30,000 of revenue (1% GST credit)
      const eligibleForCredit = Math.min(totalRevenueWithTax, QUICK_METHOD_CREDIT_THRESHOLD);
      const gstCredit = round2(eligibleForCredit * (QUICK_METHOD_CREDIT_RATE_GST / 100));

      quickMethodData = {
        revenue: totalRevenueWithTax,
        gstRate: qmRates.gst,
        qstRate: qmRates.qst,
        gstRemittance: round2(gstRemittance - gstCredit),
        qstRemittance,
        totalRemittance: round2(gstRemittance - gstCredit + qstRemittance),
        creditThreshold: QUICK_METHOD_CREDIT_THRESHOLD,
        gstCredit,
      };
    }

    // -----------------------------------------------------------------------
    // 6. Get province tax info
    // -----------------------------------------------------------------------
    const provinceTaxInfo = PROVINCIAL_TAX_RATES.find(p => p.provinceCode === province);

    // -----------------------------------------------------------------------
    // 7. Build response
    // -----------------------------------------------------------------------
    const response = {
      period: {
        startDate: startDateParam,
        endDate: endDateParam,
        province,
        provinceName: provinceTaxInfo?.provinceName || province,
        provinceNameFr: provinceTaxInfo?.provinceNameFr || province,
      },
      method,
      supplies: {
        taxable: taxableSupplies,
        zeroRated: zeroRatedSupplies,
        exempt: exemptSupplies,
        total: totalSupplies,
      },
      gst: {
        collected: gstCollected,
        itc,
        net: netGst,
        // FPZ-500 line references
        line105: gstCollected,  // Line 105: GST/HST collected
        line108: itc,           // Line 108: ITCs
        line109: netGst,        // Line 109: Net tax
      },
      qst: {
        collected: qstCollected,
        itr,
        net: netQst,
      },
      totalRemittance,
      quickMethod: quickMethodData,
      verification: {
        supplierTpsFromInvoices: supplierTpsTotal,
        supplierTvqFromInvoices: supplierTvqTotal,
        itcFromJournal: itc,
        itrFromJournal: itr,
        customerInvoiceCount: customerInvoices.length,
        supplierInvoiceCount: supplierInvoices.length,
        journalLineCount: journalLines.length,
      },
      summary: {
        isRefund: totalRemittance < 0,
        amountOwing: totalRemittance > 0 ? totalRemittance : 0,
        amountRefund: totalRemittance < 0 ? Math.abs(totalRemittance) : 0,
        effectiveMethod: method,
        effectiveRemittance: method === 'quick' && quickMethodData
          ? quickMethodData.totalRemittance
          : totalRemittance,
      },
      provinceTaxRates: PROVINCIAL_TAX_RATES.map(p => ({
        provinceCode: p.provinceCode,
        provinceName: p.provinceName,
        provinceNameFr: p.provinceNameFr,
        gstRate: p.gstRate,
        pstRate: p.pstRate,
        hstRate: p.hstRate,
        totalRate: p.totalRate,
        pstName: p.pstName,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('GST/QST declaration GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors du calcul de la declaration TPS/TVQ' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/gst-qst-declaration
// Save or submit a GST/QST declaration as a TaxReport record.
//
// Body:
//   - startDate, endDate (ISO strings)
//   - method ('regular' | 'quick')
//   - province (two-letter code)
//   - status ('DRAFT' | 'GENERATED' | 'FILED')
//   - data (full declaration data object from GET)
// ---------------------------------------------------------------------------
export const POST = withAdminGuard(async (request) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/gst-qst-declaration');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = gstQstDeclarationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { startDate, endDate, method, province, status, data } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide' },
        { status: 400 }
      );
    }

    const year = start.getFullYear();
    const startMonth = start.getMonth() + 1;
    const endMonth = end.getMonth() + 1;
    const regionCode = (province || 'QC').toUpperCase();

    // Determine period type and values
    let periodType = 'ANNUAL';
    let month: number | null = null;
    let quarter: number | null = null;
    let periodLabel = `${year}`;

    const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + (endMonth - startMonth);

    if (monthDiff === 0) {
      periodType = 'MONTHLY';
      month = startMonth;
      periodLabel = `${year}-${String(startMonth).padStart(2, '0')}`;
    } else if (monthDiff === 2) {
      periodType = 'QUARTERLY';
      quarter = Math.ceil(startMonth / 3);
      periodLabel = `${year}-Q${quarter}`;
    }

    // Check for duplicate
    const duplicateWhere: Record<string, unknown> = {
      year,
      regionCode,
      periodType,
    };
    if (month) duplicateWhere.month = month;
    if (quarter) duplicateWhere.quarter = quarter;

    const existing = await prisma.taxReport.findFirst({ where: duplicateWhere });
    if (existing) {
      return NextResponse.json(
        {
          error: `Une declaration TPS/TVQ existe deja pour cette periode (${periodLabel}, ${regionCode})`,
          existingId: existing.id,
        },
        { status: 409 }
      );
    }

    // Extract financial data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const declarationData = data as any;
    const gstCollected = declarationData?.gst?.collected || 0;
    const qstCollected = declarationData?.qst?.collected || 0;
    const itc = declarationData?.gst?.itc || 0;
    const itr = declarationData?.qst?.itr || 0;
    const netGst = declarationData?.gst?.net || 0;
    const netQst = declarationData?.qst?.net || 0;
    const netTotal = declarationData?.totalRemittance || 0;
    const totalSales = declarationData?.supplies?.total || 0;

    // FIX: F006 - Use shared calculateGstQstDueDate() for consistent due date calculation
    const dueDate = calculateGstQstDueDate(end);

    // Region name mapping
    const regionMap: Record<string, string> = {
      QC: 'Quebec', ON: 'Ontario', BC: 'Colombie-Britannique',
      AB: 'Alberta', SK: 'Saskatchewan', MB: 'Manitoba',
      NS: 'Nouvelle-Ecosse', NB: 'Nouveau-Brunswick',
      NL: 'Terre-Neuve-et-Labrador', PE: 'Ile-du-Prince-Edouard',
      YT: 'Yukon', NT: 'Territoires du Nord-Ouest', NU: 'Nunavut',
    };

    const validStatuses = ['DRAFT', 'GENERATED', 'FILED'];
    const reportStatus = validStatuses.includes(status) ? status : 'GENERATED';

    const report = await prisma.taxReport.create({
      data: {
        period: periodLabel,
        periodType,
        year,
        month,
        quarter,
        region: regionMap[regionCode] || regionCode,
        regionCode,
        tpsCollected: gstCollected,
        tvqCollected: qstCollected,
        tpsPaid: itc,
        tvqPaid: itr,
        netTps: netGst,
        netTvq: netQst,
        netTvh: 0,
        netTotal,
        salesCount: declarationData?.verification?.customerInvoiceCount || 0,
        totalSales,
        status: reportStatus,
        dueDate,
        notes: JSON.stringify({
          type: 'GST_QST',
          method: method || 'regular',
          province: regionCode,
          quickMethod: declarationData?.quickMethod || null,
          generatedFrom: 'gst-qst-declaration-api',
          supplies: declarationData?.supplies || null,
        }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        report: {
          ...report,
          tpsCollected: Number(report.tpsCollected),
          tvqCollected: Number(report.tvqCollected),
          tpsPaid: Number(report.tpsPaid),
          tvqPaid: Number(report.tvqPaid),
          netTps: Number(report.netTps),
          netTvq: Number(report.netTvq),
          netTvh: Number(report.netTvh),
          netTotal: Number(report.netTotal),
          totalSales: Number(report.totalSales),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('GST/QST declaration POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde de la declaration TPS/TVQ' },
      { status: 500 }
    );
  }
});
