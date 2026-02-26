export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async () => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [revenueData, expenseData, outstandingInvoices, recentTransactions] = await Promise.all([
      prisma.journalEntry.aggregate({
        where: { date: { gte: monthStart }, status: 'POSTED', lines: { some: { account: { code: { startsWith: '4' } } } } },
        _sum: { totalAmount: true },
      }),
      prisma.journalEntry.aggregate({
        where: { date: { gte: monthStart }, status: 'POSTED', lines: { some: { account: { code: { startsWith: '5' } } } } },
        _sum: { totalAmount: true },
      }),
      prisma.customerInvoice.findMany({
        where: { status: { in: ['SENT', 'OVERDUE'] } },
        select: { id: true, invoiceNumber: true, totalAmount: true, dueDate: true, status: true },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      prisma.journalEntry.findMany({
        where: { status: 'POSTED' },
        select: { id: true, description: true, date: true, totalAmount: true, entryType: true },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);

    const revenue = Number(revenueData._sum.totalAmount || 0);
    const expenses = Number(expenseData._sum.totalAmount || 0);
    const outstandingTotal = outstandingInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);

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
        amount: Number(t.totalAmount),
        type: t.entryType,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur dashboard mobile' }, { status: 500 });
  }
});
