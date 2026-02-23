export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import {
  generateTaxReportHTML,
  generateIncomeStatementHTML,
  generateBalanceSheetHTML,
  generateJournalEntryHTML,
} from '@/lib/accounting';
import { logger } from '@/lib/logger';

/**
 * GET /api/accounting/reports/pdf
 * Generate PDF report (returns HTML that can be printed/saved as PDF)
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const period = searchParams.get('period') || 'Janvier 2026';
    const locale = searchParams.get('locale') || 'fr';

    let html = '';

    switch (reportType) {
      case 'tax': {
        // Fetch latest tax report from DB
        const taxReport = await prisma.taxReport.findFirst({
          orderBy: { createdAt: 'desc' },
        });
        if (!taxReport) {
          return NextResponse.json({ error: 'Aucun rapport de taxes trouvé' }, { status: 404 });
        }
        html = generateTaxReportHTML({
          ...taxReport,
          periodType: taxReport.periodType as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
          month: taxReport.month ?? undefined,
          quarter: taxReport.quarter ?? undefined,
          filedAt: taxReport.filedAt ?? undefined,
          paidAt: taxReport.paidAt ?? undefined,
          tpsCollected: Number(taxReport.tpsCollected),
          tvqCollected: Number(taxReport.tvqCollected),
          tvhCollected: Number(taxReport.tvhCollected),
          otherTaxCollected: Number(taxReport.otherTaxCollected),
          tpsPaid: Number(taxReport.tpsPaid),
          tvqPaid: Number(taxReport.tvqPaid),
          tvhPaid: Number(taxReport.tvhPaid),
          otherTaxPaid: Number(taxReport.otherTaxPaid),
          netTps: Number(taxReport.netTps),
          netTvq: Number(taxReport.netTvq),
          netTvh: Number(taxReport.netTvh),
          netTotal: Number(taxReport.netTotal),
          totalSales: Number(taxReport.totalSales),
          generatedAt: taxReport.createdAt,
          dueDate: taxReport.dueDate || new Date(),
        }, undefined, locale);
        break;
      }

      case 'income': {
        // Build income statement from journal entries
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const incomeWhere: Record<string, unknown> = { status: 'POSTED', deletedAt: null };

        // #81 Audit: Default to current fiscal year if no date range provided
        // to avoid fetching ALL historical entries
        if (fromParam || toParam) {
          const dateFilter: Record<string, Date> = {};
          if (fromParam) dateFilter.gte = new Date(fromParam);
          if (toParam) dateFilter.lte = new Date(toParam);
          incomeWhere.date = dateFilter;
        } else {
          // Default to current calendar year
          const currentYear = new Date().getFullYear();
          incomeWhere.date = {
            gte: new Date(currentYear, 0, 1),
            lte: new Date(currentYear, 11, 31, 23, 59, 59),
          };
        }
        const entries = await prisma.journalEntry.findMany({
          where: incomeWhere,
          include: {
            lines: { include: { account: { select: { code: true, name: true, type: true } } } },
          },
        });

        const revenue: Record<string, number> = {};
        const cogs: Record<string, number> = {};
        const expenses: Record<string, number> = {};
        const other: Record<string, number> = {};

        for (const entry of entries) {
          for (const line of entry.lines) {
            const code = line.account.code;
            const net = Number(line.credit) - Number(line.debit);
            if (code.startsWith('4')) {
              revenue[line.account.name] = (revenue[line.account.name] || 0) + net;
            } else if (code.startsWith('5')) {
              cogs[line.account.name] = (cogs[line.account.name] || 0) + Number(line.debit) - Number(line.credit);
            } else if (code.startsWith('6')) {
              expenses[line.account.name] = (expenses[line.account.name] || 0) + Number(line.debit) - Number(line.credit);
            } else if (code.startsWith('7') || code.startsWith('8')) {
              other[line.account.name] = (other[line.account.name] || 0) + net;
            }
          }
        }

        html = generateIncomeStatementHTML({ revenue, cogs, expenses, other }, period, undefined, locale);
        break;
      }

      case 'balance': {
        // Build balance sheet from chart of accounts balances
        const asOfDate = searchParams.get('asOfDate');
        const balanceEntryWhere: Record<string, unknown> = { status: 'POSTED', deletedAt: null };
        if (asOfDate) {
          balanceEntryWhere.date = { lte: new Date(asOfDate) };
        }
        const accounts = await prisma.chartOfAccount.findMany({
          where: { isActive: true },
          include: {
            journalLines: {
              where: { entry: balanceEntryWhere },
              select: { debit: true, credit: true },
            },
          },
        });

        const assets: { current: Record<string, number>; nonCurrent: Record<string, number> } = { current: {}, nonCurrent: {} };
        const liabilities: { current: Record<string, number> } = { current: {} };
        const equity: Record<string, number> = {};

        for (const acct of accounts) {
          const balance = acct.journalLines.reduce(
            (s, l) => s + Number(l.debit) - Number(l.credit),
            0
          );
          if (balance === 0) continue;

          const code = acct.code;
          if (code.startsWith('1')) {
            if (parseInt(code) < 1500) {
              assets.current[acct.name] = balance;
            } else {
              assets.nonCurrent[acct.name] = balance;
            }
          } else if (code.startsWith('2')) {
            liabilities.current[acct.name] = -balance;
          } else if (code.startsWith('3')) {
            equity[acct.name] = -balance;
          }
        }

        html = generateBalanceSheetHTML({ assets, liabilities, equity }, period, undefined, locale);
        break;
      }

      case 'entry': {
        const entryId = searchParams.get('entryId');
        if (!entryId) {
          return NextResponse.json(
            { error: 'entryId requis pour le type entry' },
            { status: 400 }
          );
        }

        const entry = await prisma.journalEntry.findUnique({
          where: { id: entryId },
          include: {
            lines: { include: { account: { select: { code: true, name: true } } } },
          },
        });

        if (!entry) {
          return NextResponse.json({ error: 'Écriture non trouvée' }, { status: 404 });
        }

        html = generateJournalEntryHTML({
          id: entry.id,
          entryNumber: entry.entryNumber,
          date: entry.date,
          description: entry.description,
          type: entry.type,
          status: entry.status,
          reference: entry.reference || undefined,
          lines: entry.lines.map((l) => ({
            id: l.id,
            accountCode: l.account.code,
            accountName: l.account.name,
            debit: Number(l.debit),
            credit: Number(l.credit),
          })),
          createdBy: entry.createdBy,
          createdAt: entry.createdAt,
          postedAt: entry.postedAt || undefined,
        }, undefined, locale);
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Type de rapport invalide. Types valides: tax, income, balance, entry' },
          { status: 400 }
        );
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    logger.error('Generate PDF error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/reports/pdf
 * Generate custom PDF with provided data
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { reportType, data, period, locale: bodyLocale } = body;
    const pdfLocale = bodyLocale || 'fr';

    if (!reportType || !data) {
      return NextResponse.json(
        { error: 'reportType et data sont requis' },
        { status: 400 }
      );
    }

    let html = '';

    switch (reportType) {
      case 'tax':
        html = generateTaxReportHTML(data, undefined, pdfLocale);
        break;
      case 'income':
        html = generateIncomeStatementHTML(data, period || 'Période personnalisée', undefined, pdfLocale);
        break;
      case 'balance':
        html = generateBalanceSheetHTML(data, period || new Date().toLocaleDateString('fr-CA'), undefined, pdfLocale);
        break;
      case 'entry':
        html = generateJournalEntryHTML(data, undefined, pdfLocale);
        break;
      default:
        return NextResponse.json(
          { error: 'Type de rapport invalide' },
          { status: 400 }
        );
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    logger.error('Generate custom PDF error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport personnalisé' },
      { status: 500 }
    );
  }
});
