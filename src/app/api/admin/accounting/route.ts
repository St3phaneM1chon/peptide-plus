export const dynamic = 'force-dynamic';

/**
 * Admin Accounting Dashboard API
 * GET - Returns aggregated accounting stats
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const [
      totalEntries,
      totalAccounts,
      totalInvoices,
      unpaidInvoices,
      totalExpenses,
      activeFiscalYears,
    ] = await Promise.all([
      prisma.journalEntry.count(),
      prisma.chartOfAccount.count(),
      prisma.customerInvoice.count(),
      prisma.customerInvoice.count({ where: { status: { in: ['DRAFT', 'SENT', 'OVERDUE'] } } }),
      prisma.expense.count(),
      prisma.fiscalYear.count({ where: { isClosed: false } }),
    ]);

    return NextResponse.json({
      entries: totalEntries,
      accounts: totalAccounts,
      invoices: { total: totalInvoices, unpaid: unpaidInvoices },
      expenses: totalExpenses,
      activeFiscalYears,
    });
  } catch (error) {
    logger.error('Admin accounting dashboard GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
