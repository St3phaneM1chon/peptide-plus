export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { getDaysPastDue, getBucket, getBucketLabels, DEFAULT_AGING_BUCKETS } from '@/lib/accounting/aging-utils';

// ---------------------------------------------------------------------------
// GET /api/accounting/ap-aging
// Accounts Payable Aging Report: Groups unpaid supplier invoices by age.
// Query params:
//   - asOfDate (ISO date string, default: now)
// ---------------------------------------------------------------------------
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const asOfDateParam = searchParams.get('asOfDate');
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date();

    // #68 Audit: Accept custom aging bucket boundaries via query param
    const bucketsParam = searchParams.get('buckets'); // e.g. "30,60,90,120"
    const boundaries = bucketsParam
      ? bucketsParam.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
      : [...DEFAULT_AGING_BUCKETS];

    // Fetch all unpaid supplier invoices (not PAID, not CANCELLED, not VOID)
    const invoices = await prisma.supplierInvoice.findMany({
      where: {
        status: { notIn: ['PAID', 'CANCELLED', 'VOID'] },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Initialize buckets dynamically from boundaries
    const bucketLabels = getBucketLabels(boundaries);
    const buckets: Record<string, { total: number; count: number; invoices: Array<{
      id: string;
      invoiceNumber: string;
      supplierName: string;
      invoiceDate: string;
      dueDate: string;
      total: number;
      amountPaid: number;
      balance: number;
      daysPastDue: number;
      status: string;
    }> }> = {};
    for (const label of bucketLabels) {
      buckets[label] = { total: 0, count: 0, invoices: [] };
    }

    let grandTotal = 0;

    for (const inv of invoices) {
      const balance = Number(inv.balance);
      if (balance <= 0) continue;

      const daysPastDue = getDaysPastDue(inv.dueDate, asOfDate);
      const bucket = getBucket(daysPastDue, boundaries);

      const entry = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        supplierName: inv.supplierName,
        invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
        dueDate: inv.dueDate.toISOString().split('T')[0],
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        balance,
        daysPastDue,
        status: inv.status,
      };

      buckets[bucket].invoices.push(entry);
      buckets[bucket].total += balance;
      buckets[bucket].count += 1;
      grandTotal += balance;
    }

    // Round totals
    for (const key of Object.keys(buckets)) {
      buckets[key].total = Math.round(buckets[key].total * 100) / 100;
    }

    // Build dynamic summary from bucket labels
    const summary: Record<string, number> = {
      totalOutstanding: Math.round(grandTotal * 100) / 100,
      totalInvoices: invoices.filter((i) => Number(i.balance) > 0).length,
    };
    for (const label of bucketLabels) {
      summary[label] = buckets[label]?.total ?? 0;
    }

    return NextResponse.json({
      asOfDate: asOfDate.toISOString().split('T')[0],
      type: 'ACCOUNTS_PAYABLE',
      buckets,
      bucketBoundaries: boundaries,
      summary,
    });
  } catch (error) {
    console.error('AP aging report error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport d\'ancienneté des comptes fournisseurs' },
      { status: 500 }
    );
  }
});
