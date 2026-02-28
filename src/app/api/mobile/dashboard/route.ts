export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async () => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Revenue: sum credits on revenue accounts (code starting with '4')
    const revenueLines = await prisma.journalLine.aggregate({
      where: {
        entry: { date: { gte: monthStart }, status: 'POSTED' },
        account: { code: { startsWith: '4' } },
      },
      _sum: { credit: true, debit: true },
    });

    // Expenses: sum debits on expense accounts (code starting with '5')
    const expenseLines = await prisma.journalLine.aggregate({
      where: {
        entry: { date: { gte: monthStart }, status: 'POSTED' },
        account: { code: { startsWith: '5' } },
      },
      _sum: { debit: true, credit: true },
    });

    const [outstandingInvoices, recentTransactions] = await Promise.all([
      prisma.customerInvoice.findMany({
        where: { status: { in: ['SENT', 'OVERDUE'] } },
        select: { id: true, invoiceNumber: true, total: true, dueDate: true, status: true },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      prisma.journalEntry.findMany({
        where: { status: 'POSTED' },
        select: { id: true, description: true, date: true, type: true, exchangeRate: true },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);

    const revenue = Number(revenueLines._sum.credit || 0) - Number(revenueLines._sum.debit || 0);
    const expenses = Number(expenseLines._sum.debit || 0) - Number(expenseLines._sum.credit || 0);
    const outstandingTotal = outstandingInvoices.reduce((s, i) => s + Number(i.total), 0);

    return NextResponse.json({
      revenue,
      expenses,
      profit: revenue - expenses,
      profitMargin: revenue > 0 ? ((revenue - expenses) / revenue * 100).toFixed(1) : '0',
      outstandingCount: outstandingInvoices.length,
      outstandingTotal,
      outstandingInvoices,
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        description: t.description,
        date: t.date.toISOString(),
        type: t.type,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur dashboard mobile' }, { status: 500 });
  }
});
