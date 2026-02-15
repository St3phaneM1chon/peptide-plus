export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';

/**
 * GET /api/accounting/dashboard
 * Returns accounting dashboard data
 * SECURITY: Requires EMPLOYEE or OWNER role
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      paidOrders,
      expenseLines,
      pendingInvoices,
      bankAccounts,
      recentEntries,
      recentOrders,
      alerts,
    ] = await Promise.all([
      // Total revenue: sum of Order.total where paymentStatus='PAID' current month
      prisma.order.findMany({
        where: {
          paymentStatus: 'PAID',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        select: { total: true },
      }),
      // Total expenses: sum of JournalLine.debit for expense accounts current month
      prisma.journalLine.findMany({
        where: {
          account: { type: 'EXPENSE' },
          entry: {
            status: 'POSTED',
            date: { gte: startOfMonth, lte: endOfMonth },
          },
        },
        select: { debit: true },
      }),
      // Pending invoices count
      prisma.customerInvoice.count({
        where: { status: { in: ['SENT', 'OVERDUE'] } },
      }),
      // Bank balance
      prisma.bankAccount.findMany({
        where: { isActive: true },
        select: { currentBalance: true },
      }),
      // Recent entries
      prisma.journalEntry.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            include: { account: { select: { code: true, name: true } } },
          },
        },
      }),
      // Recent orders
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      // Active alerts
      prisma.accountingAlert.findMany({
        where: { resolvedAt: null },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
    const totalExpenses = expenseLines.reduce((s, l) => s + Number(l.debit), 0);
    const bankBalance = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);

    return NextResponse.json({
      totalRevenue,
      totalExpenses,
      pendingInvoices,
      bankBalance,
      recentEntries,
      recentOrders,
      alerts,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du tableau de bord' },
      { status: 500 }
    );
  }
}
