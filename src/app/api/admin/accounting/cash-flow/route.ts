export const dynamic = 'force-dynamic';

/**
 * Admin Cash Flow Statement API
 * GET - Returns cash inflows and outflows for a date range,
 *       grouped by category: Operating, Investing, Financing
 *
 * Query params:
 *   from  - start date (YYYY-MM-DD), defaults to first day of current month
 *   to    - end date   (YYYY-MM-DD), defaults to today
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { roundCurrency } from '@/lib/financial';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

/** Map ChartOfAccount type to cash-flow category */
function toCashFlowCategory(accountType: string, accountCode: string): string {
  // Financing: equity, long-term liabilities (codes starting with 2xxx for liabilities)
  if (accountType === 'EQUITY') return 'FINANCING';
  if (accountType === 'LIABILITY' && accountCode >= '2500') return 'FINANCING';

  // Investing: fixed assets (codes starting with 15xx-19xx typically)
  if (accountType === 'ASSET' && accountCode >= '1500' && accountCode < '2000') return 'INVESTING';

  // Everything else is Operating
  return 'OPERATING';
}

// ---------------------------------------------------------------------------
// GET /api/admin/accounting/cash-flow
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = parseDate(searchParams.get('from'), startOfMonth);
    const endDate = parseDate(searchParams.get('to'), now);

    // Ensure end date includes the full day
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    // -----------------------------------------------------------------------
    // 1. Cash inflows from paid orders (Operating - Revenue)
    // -----------------------------------------------------------------------
    const paidOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: startDate, lte: endOfDay },
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        createdAt: true,
        shippingState: true,
      },
      take: 1000,
    });

    const orderInflows = roundCurrency(
      paidOrders.reduce((sum, o) => sum + Number(o.total), 0)
    );

    // -----------------------------------------------------------------------
    // 2. Cash outflows from supplier invoices paid (Operating - Purchases)
    // -----------------------------------------------------------------------
    const paidSupplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIAL'] },
        paidAt: { gte: startDate, lte: endOfDay },
      },
      select: {
        id: true,
        invoiceNumber: true,
        supplierName: true,
        amountPaid: true,
        total: true,
        expenseCategory: true,
        paidAt: true,
      },
      take: 1000,
    });

    const supplierOutflows = roundCurrency(
      paidSupplierInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0)
    );

    // -----------------------------------------------------------------------
    // 3. Refunds / Credit notes issued (Operating - Refunds)
    // -----------------------------------------------------------------------
    const issuedCreditNotes = await prisma.creditNote.findMany({
      where: {
        status: 'ISSUED',
        issuedAt: { gte: startDate, lte: endOfDay },
      },
      select: {
        id: true,
        creditNoteNumber: true,
        total: true,
        issuedAt: true,
      },
      take: 1000,
    });

    const refundOutflows = roundCurrency(
      issuedCreditNotes.reduce((sum, cn) => sum + Number(cn.total), 0)
    );

    // -----------------------------------------------------------------------
    // 4. Purchase orders received (Operating - Inventory purchases)
    // -----------------------------------------------------------------------
    const receivedPOs = await prisma.purchaseOrder.findMany({
      where: {
        status: { in: ['RECEIVED', 'PARTIAL'] },
        receivedAt: { gte: startDate, lte: endOfDay },
      },
      select: {
        id: true,
        poNumber: true,
        total: true,
        receivedAt: true,
      },
      take: 1000,
    });

    const poOutflows = roundCurrency(
      receivedPOs.reduce((sum, po) => sum + Number(po.total), 0)
    );

    // -----------------------------------------------------------------------
    // 5. Journal-based cash flows (Investing & Financing)
    //    Look at posted journal entries that affect bank/cash accounts
    // -----------------------------------------------------------------------
    const journalLines = await prisma.journalLine.findMany({
      where: {
        entry: {
          status: 'POSTED',
          date: { gte: startDate, lte: endOfDay },
        },
      },
      include: {
        account: { select: { code: true, name: true, type: true } },
        entry: { select: { date: true, description: true, type: true } },
      },
      take: 1000,
    });

    // Aggregate investing and financing flows from journal entries
    let investingInflows = 0;
    let investingOutflows = 0;
    let financingInflows = 0;
    let financingOutflows = 0;

    for (const line of journalLines) {
      const category = toCashFlowCategory(line.account.type, line.account.code);
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      if (category === 'INVESTING') {
        investingInflows += credit;
        investingOutflows += debit;
      } else if (category === 'FINANCING') {
        financingInflows += credit;
        financingOutflows += debit;
      }
    }

    // -----------------------------------------------------------------------
    // Build response
    // -----------------------------------------------------------------------
    const operating = {
      inflows: {
        salesRevenue: orderInflows,
        total: orderInflows,
      },
      outflows: {
        supplierPayments: supplierOutflows,
        refunds: refundOutflows,
        purchaseOrders: poOutflows,
        total: roundCurrency(supplierOutflows + refundOutflows + poOutflows),
      },
      net: roundCurrency(orderInflows - supplierOutflows - refundOutflows - poOutflows),
    };

    const investing = {
      inflows: {
        assetDisposals: roundCurrency(investingInflows),
        total: roundCurrency(investingInflows),
      },
      outflows: {
        assetPurchases: roundCurrency(investingOutflows),
        total: roundCurrency(investingOutflows),
      },
      net: roundCurrency(investingInflows - investingOutflows),
    };

    const financing = {
      inflows: {
        capitalContributions: roundCurrency(financingInflows),
        total: roundCurrency(financingInflows),
      },
      outflows: {
        debtRepayments: roundCurrency(financingOutflows),
        total: roundCurrency(financingOutflows),
      },
      net: roundCurrency(financingInflows - financingOutflows),
    };

    const netCashFlow = roundCurrency(operating.net + investing.net + financing.net);

    return NextResponse.json({
      period: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      },
      operating,
      investing,
      financing,
      netCashFlow,
      summary: {
        totalInflows: roundCurrency(
          operating.inflows.total + investing.inflows.total + financing.inflows.total
        ),
        totalOutflows: roundCurrency(
          operating.outflows.total + investing.outflows.total + financing.outflows.total
        ),
        netChange: netCashFlow,
      },
      meta: {
        ordersCount: paidOrders.length,
        supplierInvoicesCount: paidSupplierInvoices.length,
        creditNotesCount: issuedCreditNotes.length,
        purchaseOrdersCount: receivedPOs.length,
      },
    });
  } catch (error) {
    logger.error('Cash flow statement error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la generation du flux de tresorerie' },
      { status: 500 }
    );
  }
});
