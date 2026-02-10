import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import {
  generateTaxReportHTML,
  generateIncomeStatementHTML,
  generateBalanceSheetHTML,
  generateJournalEntryHTML,
} from '@/lib/accounting';

/**
 * GET /api/accounting/reports/pdf
 * Generate PDF report (returns HTML that can be printed/saved as PDF)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const period = searchParams.get('period') || 'Janvier 2026';

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
        });
        break;
      }

      case 'income': {
        // Build income statement from journal entries
        const entries = await prisma.journalEntry.findMany({
          where: { status: 'POSTED' },
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

        html = generateIncomeStatementHTML({ revenue, cogs, expenses, other }, period);
        break;
      }

      case 'balance': {
        // Build balance sheet from chart of accounts balances
        const accounts = await prisma.chartOfAccount.findMany({
          where: { isActive: true },
          include: {
            journalLines: {
              where: { entry: { status: 'POSTED' } },
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

        html = generateBalanceSheetHTML({ assets, liabilities, equity }, period);
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
        });
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
      },
    });
  } catch (error) {
    console.error('Generate PDF error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/reports/pdf
 * Generate custom PDF with provided data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { reportType, data, period } = body;

    if (!reportType || !data) {
      return NextResponse.json(
        { error: 'reportType et data sont requis' },
        { status: 400 }
      );
    }

    let html = '';

    switch (reportType) {
      case 'tax':
        html = generateTaxReportHTML(data);
        break;
      case 'income':
        html = generateIncomeStatementHTML(data, period || 'Période personnalisée');
        break;
      case 'balance':
        html = generateBalanceSheetHTML(data, period || new Date().toLocaleDateString('fr-CA'));
        break;
      case 'entry':
        html = generateJournalEntryHTML(data);
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
      },
    });
  } catch (error) {
    console.error('Generate custom PDF error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport personnalisé' },
      { status: 500 }
    );
  }
}
