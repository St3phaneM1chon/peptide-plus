export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatementLineItem {
  /** Unique ID of the source record */
  id: string;
  /** Date of the transaction */
  date: string; // ISO 8601
  /** Type: INVOICE, CREDIT_NOTE, or PAYMENT */
  type: 'INVOICE' | 'CREDIT_NOTE' | 'PAYMENT';
  /** Reference number (invoice number, credit note number, etc.) */
  reference: string;
  /** Description text */
  description: string;
  /** Status of the source record */
  status: string;
  /** Debit amount (charges - invoices) */
  debit: number;
  /** Credit amount (payments, credit notes) */
  credit: number;
  /** Running balance after this line */
  runningBalance: number;
}

interface CustomerStatementData {
  /** Customer identifier */
  customerId: string | null;
  /** Customer name */
  customerName: string;
  /** Customer email */
  customerEmail: string | null;
  /** Statement period start */
  dateFrom: string;
  /** Statement period end */
  dateTo: string;
  /** Generated timestamp */
  generatedAt: string;
  /** Opening balance (total owed before dateFrom) */
  openingBalance: number;
  /** Total charges (invoices) in period */
  totalDebits: number;
  /** Total credits (payments + credit notes) in period */
  totalCredits: number;
  /** Closing balance = opening + debits - credits */
  closingBalance: number;
  /** Currency */
  currency: string;
  /** Line items sorted by date */
  lineItems: StatementLineItem[];
  /** Summary by invoice status */
  statusSummary: {
    draft: number;
    sent: number;
    overdue: number;
    partial: number;
    paid: number;
  };
  /** Aging summary */
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely convert Prisma Decimal to number */
function toNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'toNumber' in val && typeof (val as { toNumber: () => number }).toNumber === 'function') {
    return (val as { toNumber: () => number }).toNumber();
  }
  return Number(val);
}

// ---------------------------------------------------------------------------
// GET /api/accounting/customer-statements
// ---------------------------------------------------------------------------

/**
 * GET /api/accounting/customer-statements
 *
 * Generate a customer statement showing all invoices, credit notes, payments,
 * and running balance for a given period.
 *
 * Query Parameters:
 *   - customerId (optional): Filter by customer ID. If omitted, customerName is required.
 *   - customerName (optional): Filter by customer name (exact match). Used when customerId not available.
 *   - dateFrom (required): Start of statement period (ISO date: YYYY-MM-DD)
 *   - dateTo (required): End of statement period (ISO date: YYYY-MM-DD)
 *
 * Returns:
 *   - Opening balance (amount owed before the period)
 *   - Line items (invoices, credit notes, payments) with running balance
 *   - Closing balance
 *   - Status and aging summaries
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const customerName = searchParams.get('customerName');
    const dateFromStr = searchParams.get('dateFrom');
    const dateToStr = searchParams.get('dateTo');

    // ---------------------------------------------------------------
    // 1. Validate parameters
    // ---------------------------------------------------------------
    if (!customerId && !customerName) {
      return NextResponse.json(
        { error: 'Parametre customerId ou customerName requis' },
        { status: 400 }
      );
    }

    if (!dateFromStr || !dateToStr) {
      return NextResponse.json(
        { error: 'Parametres dateFrom et dateTo requis (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const dateFrom = new Date(dateFromStr);
    const dateTo = new Date(dateToStr);

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide. Utilisez le format ISO (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (dateFrom > dateTo) {
      return NextResponse.json(
        { error: 'La date de debut doit etre anterieure a la date de fin' },
        { status: 400 }
      );
    }

    // Max range: 2 years
    const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
    if (dateTo.getTime() - dateFrom.getTime() > twoYearsMs) {
      return NextResponse.json(
        { error: 'La plage de dates ne peut pas depasser 2 ans' },
        { status: 400 }
      );
    }

    // Set dateTo to end of day
    const dateToEnd = new Date(dateTo);
    dateToEnd.setHours(23, 59, 59, 999);

    // ---------------------------------------------------------------
    // 2. Build customer filter
    // ---------------------------------------------------------------
    const customerFilter: Record<string, unknown> = {};
    if (customerId) {
      customerFilter.customerId = customerId;
    } else if (customerName) {
      customerFilter.customerName = customerName;
    }

    // ---------------------------------------------------------------
    // 3. Fetch invoices in the period
    // ---------------------------------------------------------------
    const invoicesInPeriod = await prisma.customerInvoice.findMany({
      where: {
        ...customerFilter,
        deletedAt: null,
        invoiceDate: {
          gte: dateFrom,
          lte: dateToEnd,
        },
      },
      orderBy: { invoiceDate: 'asc' },
    });

    // ---------------------------------------------------------------
    // 4. Calculate opening balance (invoices before dateFrom)
    // ---------------------------------------------------------------
    const priorInvoices = await prisma.customerInvoice.findMany({
      where: {
        ...customerFilter,
        deletedAt: null,
        invoiceDate: { lt: dateFrom },
        status: { notIn: ['VOID', 'CANCELLED'] },
      },
      select: { balance: true, customerName: true },
    });

    // Also count prior credit notes.
    // CreditNote has its own customerName field, but no customerId.
    // When filtering by customerId, we first find the customer's name from invoices,
    // then filter credit notes by customerName for reliability (invoiceId is optional on CreditNote).
    let creditNoteNameToFilter: string | null = null;
    if (customerId) {
      // Try to get customer name from prior invoices, or any invoice for this customer
      const nameSource = priorInvoices.length > 0
        ? priorInvoices[0]
        : await prisma.customerInvoice.findFirst({
            where: { customerId, deletedAt: null },
            select: { customerName: true },
          });
      creditNoteNameToFilter = nameSource?.customerName || null;
    } else {
      creditNoteNameToFilter = customerName;
    }

    const priorCreditNotes = creditNoteNameToFilter
      ? await prisma.creditNote.findMany({
          where: {
            customerName: creditNoteNameToFilter,
            deletedAt: null,
            createdAt: { lt: dateFrom },
            status: { notIn: ['VOID'] },
          },
          select: { total: true },
        })
      : [];

    const openingBalance = priorInvoices.reduce((sum, inv) => sum + toNum(inv.balance), 0)
      - priorCreditNotes.reduce((sum, cn) => sum + toNum(cn.total), 0);

    // ---------------------------------------------------------------
    // 5. Fetch credit notes in the period
    // ---------------------------------------------------------------
    const creditNotesInPeriod = creditNoteNameToFilter
      ? await prisma.creditNote.findMany({
          where: {
            customerName: creditNoteNameToFilter,
            deletedAt: null,
            createdAt: {
              gte: dateFrom,
              lte: dateToEnd,
            },
            status: { notIn: ['VOID'] },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // ---------------------------------------------------------------
    // 6. Build line items
    // ---------------------------------------------------------------
    const lineItems: StatementLineItem[] = [];

    // Add invoices
    for (const inv of invoicesInPeriod) {
      if (inv.status === 'VOID' || inv.status === 'CANCELLED') continue;

      lineItems.push({
        id: inv.id,
        date: inv.invoiceDate.toISOString(),
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        description: `Facture ${inv.invoiceNumber}`,
        status: inv.status,
        debit: toNum(inv.total),
        credit: 0,
        runningBalance: 0, // Calculated below
      });

      // If the invoice has been (partially) paid, add a payment line
      const amountPaid = toNum(inv.amountPaid);
      if (amountPaid > 0) {
        const paymentDate = inv.paidAt || inv.updatedAt;
        // Only add payment if it falls within the period
        if (paymentDate >= dateFrom && paymentDate <= dateToEnd) {
          lineItems.push({
            id: `${inv.id}-payment`,
            date: paymentDate.toISOString(),
            type: 'PAYMENT',
            reference: inv.invoiceNumber,
            description: `Paiement sur facture ${inv.invoiceNumber}`,
            status: inv.status === 'PAID' ? 'COMPLETE' : 'PARTIAL',
            debit: 0,
            credit: amountPaid,
            runningBalance: 0,
          });
        }
      }
    }

    // Add credit notes
    for (const cn of creditNotesInPeriod) {
      lineItems.push({
        id: cn.id,
        date: cn.createdAt.toISOString(),
        type: 'CREDIT_NOTE',
        reference: cn.creditNoteNumber,
        description: `Note de credit ${cn.creditNoteNumber} - ${cn.reason}`,
        status: cn.status,
        debit: 0,
        credit: toNum(cn.total),
        runningBalance: 0,
      });
    }

    // ---------------------------------------------------------------
    // 7. Sort by date and calculate running balance
    // ---------------------------------------------------------------
    lineItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    for (const item of lineItems) {
      runningBalance += item.debit - item.credit;
      item.runningBalance = Math.round(runningBalance * 100) / 100;
      totalDebits += item.debit;
      totalCredits += item.credit;
    }

    const closingBalance = Math.round(runningBalance * 100) / 100;

    // ---------------------------------------------------------------
    // 8. Status summary (across all non-deleted invoices for this customer)
    // ---------------------------------------------------------------
    const allInvoices = await prisma.customerInvoice.findMany({
      where: {
        ...customerFilter,
        deletedAt: null,
        status: { notIn: ['VOID', 'CANCELLED'] },
      },
      select: { status: true, balance: true, dueDate: true },
    });

    const statusSummary = {
      draft: 0,
      sent: 0,
      overdue: 0,
      partial: 0,
      paid: 0,
    };

    const now = new Date();
    const aging = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
    };

    for (const inv of allInvoices) {
      const balance = toNum(inv.balance);
      const status = inv.status as string;

      switch (status) {
        case 'DRAFT': statusSummary.draft += balance; break;
        case 'SENT': statusSummary.sent += balance; break;
        case 'OVERDUE': statusSummary.overdue += balance; break;
        case 'PARTIAL': statusSummary.partial += balance; break;
        case 'PAID': statusSummary.paid += balance; break;
      }

      // Aging: only for unpaid invoices
      if (balance > 0 && status !== 'PAID' && status !== 'DRAFT') {
        const daysPastDue = Math.floor(
          (now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysPastDue <= 0) {
          aging.current += balance;
        } else if (daysPastDue <= 30) {
          aging.days1to30 += balance;
        } else if (daysPastDue <= 60) {
          aging.days31to60 += balance;
        } else if (daysPastDue <= 90) {
          aging.days61to90 += balance;
        } else {
          aging.over90 += balance;
        }
      }
    }

    // Round aging values
    for (const key of Object.keys(aging) as Array<keyof typeof aging>) {
      aging[key] = Math.round(aging[key] * 100) / 100;
    }
    for (const key of Object.keys(statusSummary) as Array<keyof typeof statusSummary>) {
      statusSummary[key] = Math.round(statusSummary[key] * 100) / 100;
    }

    // ---------------------------------------------------------------
    // 9. Determine customer name for the statement
    // ---------------------------------------------------------------
    const statementCustomerName =
      invoicesInPeriod[0]?.customerName ||
      (customerName ? customerName : 'Client inconnu');
    const statementCustomerEmail = invoicesInPeriod[0]?.customerEmail || null;

    // ---------------------------------------------------------------
    // 10. Build response
    // ---------------------------------------------------------------
    const statement: CustomerStatementData = {
      customerId: customerId || invoicesInPeriod[0]?.customerId || null,
      customerName: statementCustomerName,
      customerEmail: statementCustomerEmail,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateToEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      openingBalance: Math.round(openingBalance * 100) / 100,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      closingBalance,
      currency: invoicesInPeriod[0]?.currency || 'CAD',
      lineItems,
      statusSummary,
      aging,
    };

    logger.info('Customer statement generated', {
      customerId,
      customerName: statementCustomerName,
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      lineItemCount: lineItems.length,
      closingBalance,
    });

    return NextResponse.json({
      success: true,
      data: statement,
    });
  } catch (error) {
    logger.error('Customer statement generation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la generation du releve client' },
      { status: 500 }
    );
  }
});
