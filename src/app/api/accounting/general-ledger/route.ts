export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/general-ledger
 * General ledger data grouped by account with running balances
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
    const accountCode = searchParams.get('accountCode');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build where clause for journal lines
    const where: Record<string, unknown> = {
      entry: { status: 'POSTED' },
    };

    if (accountCode) {
      where.account = { code: accountCode };
    }

    if (from || to) {
      where.entry = { ...where.entry as Record<string, unknown> };
      if (from) (where.entry as Record<string, unknown>).date = { ...(where.entry as Record<string, unknown>).date as Record<string, unknown> || {}, gte: new Date(from) };
      if (to) {
        const existingDate = (where.entry as Record<string, unknown>).date as Record<string, unknown> || {};
        (where.entry as Record<string, unknown>).date = { ...existingDate, lte: new Date(to) };
      }
    }

    const lines = await prisma.journalLine.findMany({
      where,
      include: {
        account: { select: { code: true, name: true, type: true, normalBalance: true } },
        entry: { select: { entryNumber: true, date: true, description: true, status: true } },
      },
      orderBy: [
        { account: { code: 'asc' } },
        { entry: { date: 'asc' } },
      ],
    });

    // Group by account and compute running balances
    const accountsMap = new Map<string, {
      accountCode: string;
      accountName: string;
      accountType: string;
      normalBalance: string;
      entries: Array<{
        entryNumber: string;
        date: string;
        description: string;
        debit: number;
        credit: number;
        balance: number;
      }>;
      totalDebits: number;
      totalCredits: number;
      balance: number;
    }>();

    for (const line of lines) {
      const code = line.account.code;
      if (!accountsMap.has(code)) {
        accountsMap.set(code, {
          accountCode: code,
          accountName: line.account.name,
          accountType: line.account.type,
          normalBalance: line.account.normalBalance,
          entries: [],
          totalDebits: 0,
          totalCredits: 0,
          balance: 0,
        });
      }

      const acc = accountsMap.get(code)!;
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      acc.totalDebits += debit;
      acc.totalCredits += credit;

      // Running balance based on normal balance
      if (acc.normalBalance === 'DEBIT') {
        acc.balance += debit - credit;
      } else {
        acc.balance += credit - debit;
      }

      acc.entries.push({
        entryNumber: line.entry.entryNumber,
        date: line.entry.date.toISOString().split('T')[0],
        description: line.entry.description,
        debit,
        credit,
        balance: Math.round(acc.balance * 100) / 100,
      });
    }

    const accounts = Array.from(accountsMap.values()).map((acc) => ({
      ...acc,
      totalDebits: Math.round(acc.totalDebits * 100) / 100,
      totalCredits: Math.round(acc.totalCredits * 100) / 100,
      balance: Math.round(acc.balance * 100) / 100,
    }));

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('General ledger error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du grand livre' },
      { status: 500 }
    );
  }
}
