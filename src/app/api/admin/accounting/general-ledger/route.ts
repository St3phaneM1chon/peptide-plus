export const dynamic = 'force-dynamic';

/**
 * Admin General Ledger API
 * GET - Returns all posted transactions for a specific account with running balance
 *
 * Query params:
 *   accountId  - (required) ChartOfAccount ID
 *   startDate  - start date filter (YYYY-MM-DD)
 *   endDate    - end date filter   (YYYY-MM-DD)
 *   page       - page number (default 1)
 *   limit      - items per page (default 50, max 200)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { roundCurrency } from '@/lib/financial';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET /api/admin/accounting/general-ledger
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    // ------ Required param ------
    const accountId = searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json(
        { error: 'Le parametre accountId est requis' },
        { status: 400 }
      );
    }

    // ------ Optional params ------
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 200);
    const offset = (page - 1) * limit;

    // ------ Verify account exists ------
    const account = await prisma.chartOfAccount.findUnique({
      where: { id: accountId },
      select: { id: true, code: true, name: true, type: true, normalBalance: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Compte introuvable' },
        { status: 404 }
      );
    }

    // ------ Build where clause ------
    const where: Record<string, unknown> = {
      accountId,
      entry: { status: 'POSTED' } as Record<string, unknown>,
    };

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) dateFilter.gte = d;
      }
      if (endDate) {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          dateFilter.lte = d;
        }
      }
      if (Object.keys(dateFilter).length > 0) {
        (where.entry as Record<string, unknown>).date = dateFilter;
      }
    }

    // ------ Fetch total count + paginated lines ------
    const [total, lines] = await Promise.all([
      prisma.journalLine.count({ where }),
      prisma.journalLine.findMany({
        where,
        include: {
          entry: {
            select: {
              id: true,
              entryNumber: true,
              date: true,
              description: true,
              type: true,
              reference: true,
              orderId: true,
            },
          },
        },
        orderBy: { entry: { date: 'asc' } },
        skip: offset,
        take: limit,
      }),
    ]);

    // ------ Compute opening balance (sum of all prior entries) ------
    let openingBalance = 0;
    if (offset > 0 || startDate) {
      const priorWhere: Record<string, unknown> = {
        accountId,
        entry: { status: 'POSTED' } as Record<string, unknown>,
      };

      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) {
          (priorWhere.entry as Record<string, unknown>).date = { lt: d };
        }
      }

      const priorLines = await prisma.journalLine.findMany({
        where: priorWhere,
        select: { debit: true, credit: true },
      });

      for (const pl of priorLines) {
        const debit = Number(pl.debit);
        const credit = Number(pl.credit);
        if (account.normalBalance === 'DEBIT') {
          openingBalance += debit - credit;
        } else {
          openingBalance += credit - debit;
        }
      }
      openingBalance = roundCurrency(openingBalance);
    }

    // ------ Build entries with running balance ------
    let runningBalance = openingBalance;
    const entries = lines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      if (account.normalBalance === 'DEBIT') {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      return {
        id: line.id,
        entryId: line.entry.id,
        entryNumber: line.entry.entryNumber,
        date: line.entry.date.toISOString().split('T')[0],
        description: line.description || line.entry.description,
        type: line.entry.type,
        reference: line.entry.reference,
        orderId: line.entry.orderId,
        debit: roundCurrency(debit),
        credit: roundCurrency(credit),
        balance: roundCurrency(runningBalance),
        costCenter: line.costCenter,
        projectCode: line.projectCode,
      };
    });

    // ------ Totals for the page ------
    const pageDebits = roundCurrency(entries.reduce((s, e) => s + e.debit, 0));
    const pageCredits = roundCurrency(entries.reduce((s, e) => s + e.credit, 0));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
      },
      openingBalance,
      entries,
      closingBalance: roundCurrency(runningBalance),
      totals: {
        debits: pageDebits,
        credits: pageCredits,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    logger.error('General ledger error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation du grand livre' },
      { status: 500 }
    );
  }
});
