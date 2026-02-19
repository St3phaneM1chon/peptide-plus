export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { roundCurrency } from '@/lib/financial';

/**
 * GET /api/accounting/export
 * Export accounting data to CSV format.
 *
 * Query params:
 *   type: 'journal' | 'general-ledger' | 'tax-summary' | 'chart-of-accounts'
 *   from: ISO date string (optional)
 *   to: ISO date string (optional)
 *   status: 'DRAFT' | 'POSTED' | 'VOIDED' (optional, for journal)
 *   format: 'csv' | 'json' (default 'csv') - Phase 9
 */
export const GET = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('type') || 'journal';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const status = searchParams.get('status');
    // Phase 9: Support 'csv' (default) or 'json' output format
    const format = searchParams.get('format') || 'csv';

    const exportStartTime = Date.now();
    let csv = '';
    let filename = '';

    switch (exportType) {
      case 'journal': {
        const { csvContent, name } = await exportJournalEntries(from, to, status);
        csv = csvContent;
        filename = name;
        break;
      }

      case 'general-ledger': {
        const { csvContent, name } = await exportGeneralLedger(from, to);
        csv = csvContent;
        filename = name;
        break;
      }

      case 'chart-of-accounts': {
        const { csvContent, name } = await exportChartOfAccounts();
        csv = csvContent;
        filename = name;
        break;
      }

      case 'tax-summary': {
        const { csvContent, name } = await exportTaxSummary(from, to);
        csv = csvContent;
        filename = name;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Type d'export invalide: ${exportType}. Types valides: journal, general-ledger, chart-of-accounts, tax-summary` },
          { status: 400 }
        );
    }

    // Log export metrics
    const exportDuration = Date.now() - exportStartTime;
    const exportSizeBytes = new Blob([csv]).size;
    console.info('Export completed:', {
      type: exportType,
      filename,
      format,
      sizeBytes: exportSizeBytes,
      durationMs: exportDuration,
      exportedBy: session.user.id || session.user.email,
    });

    // Phase 9: JSON format support - parse CSV rows back to structured data
    if (format === 'json') {
      const lines = csv.split('\n');
      const headers = lines[0]?.split(',').map(h => h.replace(/^"|"$/g, '').trim()) || [];
      const rows = lines.slice(1).filter(l => l.trim()).map(line => {
        const values = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = (values[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
        });
        return row;
      });
      return NextResponse.json({
        data: rows,
        meta: {
          type: exportType,
          filename: filename.replace('.csv', '.json'),
          rowCount: rows.length,
          exportDurationMs: exportDuration,
        },
      });
    }

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';

    return new NextResponse(bom + csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'export" },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

/**
 * Escape a value for safe CSV output.
 * #97 CSV injection protection: prefix dangerous characters (=, +, -, @, tab, CR)
 * with a single quote to prevent formula execution in spreadsheet applications.
 * Numeric values are passed through without sanitization.
 */
function escapeCSV(value: unknown): string {
  let str = String(value ?? '');

  // #97 Prevent CSV injection: cells starting with formula-trigger characters
  // could execute arbitrary code when opened in Excel/Google Sheets.
  // Only apply to non-numeric strings (negative numbers like -100.00 are safe).
  if (/^[=+\-@\t\r]/.test(str) && !/^-?\d+(\.\d+)?$/.test(str)) {
    str = `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// #78 Audit: Cap export row count to prevent memory exhaustion on large datasets
// TODO: Replace with ReadableStream + cursor pagination for truly large exports
const MAX_EXPORT_ROWS = 10000;

async function exportJournalEntries(
  from: string | null,
  to: string | null,
  status: string | null
): Promise<{ csvContent: string; name: string }> {
  const where: Record<string, unknown> = { deletedAt: null };
  if (status) where.status = status;
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.date = dateFilter;
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: { account: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { date: 'asc' },
    take: MAX_EXPORT_ROWS,
  });

  const headers = [
    'N° Écriture',
    'Date',
    'Description',
    'Type',
    'Statut',
    'Référence',
    'Code Compte',
    'Nom Compte',
    'Description Ligne',
    'Débit',
    'Crédit',
  ];

  const rows: string[] = [headers.map(escapeCSV).join(',')];

  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push(
        [
          escapeCSV(entry.entryNumber),
          escapeCSV(entry.date.toISOString().split('T')[0]),
          escapeCSV(entry.description),
          escapeCSV(entry.type),
          escapeCSV(entry.status),
          escapeCSV(entry.reference || ''),
          escapeCSV(line.account.code),
          escapeCSV(line.account.name),
          escapeCSV(line.description || ''),
          roundCurrency(Number(line.debit)).toFixed(2),
          roundCurrency(Number(line.credit)).toFixed(2),
        ].join(',')
      );
    }
  }

  const dateStr = new Date().toISOString().split('T')[0];
  return {
    csvContent: rows.join('\n'),
    name: `ecritures-comptables-${dateStr}.csv`,
  };
}

async function exportGeneralLedger(
  from: string | null,
  to: string | null
): Promise<{ csvContent: string; name: string }> {
  const where: Record<string, unknown> = {
    entry: { status: 'POSTED', deletedAt: null },
  };

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    (where.entry as Record<string, unknown>).date = dateFilter;
  }

  const lines = await prisma.journalLine.findMany({
    where,
    include: {
      account: { select: { code: true, name: true, type: true } },
      entry: { select: { entryNumber: true, date: true, description: true } },
    },
    orderBy: [
      { account: { code: 'asc' } },
      { entry: { date: 'asc' } },
    ],
    take: MAX_EXPORT_ROWS,
  });

  const headers = [
    'Code Compte',
    'Nom Compte',
    'Type',
    'N° Écriture',
    'Date',
    'Description',
    'Débit',
    'Crédit',
  ];

  const rows: string[] = [headers.map(escapeCSV).join(',')];

  for (const line of lines) {
    rows.push(
      [
        escapeCSV(line.account.code),
        escapeCSV(line.account.name),
        escapeCSV(line.account.type),
        escapeCSV(line.entry.entryNumber),
        escapeCSV(line.entry.date.toISOString().split('T')[0]),
        escapeCSV(line.entry.description),
        roundCurrency(Number(line.debit)).toFixed(2),
        roundCurrency(Number(line.credit)).toFixed(2),
      ].join(',')
    );
  }

  const dateStr = new Date().toISOString().split('T')[0];
  return {
    csvContent: rows.join('\n'),
    name: `grand-livre-${dateStr}.csv`,
  };
}

async function exportChartOfAccounts(): Promise<{ csvContent: string; name: string }> {
  const accounts = await prisma.chartOfAccount.findMany({
    orderBy: { code: 'asc' },
    select: {
      code: true,
      name: true,
      type: true,
      normalBalance: true,
      isActive: true,
      description: true,
    },
  });

  const headers = ['Code', 'Nom', 'Type', 'Solde Normal', 'Actif', 'Description'];
  const rows: string[] = [headers.map(escapeCSV).join(',')];

  for (const acc of accounts) {
    rows.push(
      [
        escapeCSV(acc.code),
        escapeCSV(acc.name),
        escapeCSV(acc.type),
        escapeCSV(acc.normalBalance),
        escapeCSV(acc.isActive ? 'Oui' : 'Non'),
        escapeCSV(acc.description || ''),
      ].join(',')
    );
  }

  const dateStr = new Date().toISOString().split('T')[0];
  return {
    csvContent: rows.join('\n'),
    name: `plan-comptable-${dateStr}.csv`,
  };
}

async function exportTaxSummary(
  from: string | null,
  to: string | null
): Promise<{ csvContent: string; name: string }> {
  const where: Record<string, unknown> = {};
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.generatedAt = dateFilter;
  }

  const reports = await prisma.taxReport.findMany({
    where,
    orderBy: { generatedAt: 'desc' },
    take: MAX_EXPORT_ROWS,
  });

  const headers = [
    'Période',
    'Type',
    'Année',
    'Mois',
    'Trimestre',
    'Région',
    'TPS Collectée',
    'TVQ Collectée',
    'TVH Collectée',
    'TPS Payée',
    'TVQ Payée',
    'TVH Payée',
    'Net TPS',
    'Net TVQ',
    'Net TVH',
    'Net Total',
    'Ventes Totales',
    'Nb Ventes',
    'Statut',
    'Date Échéance',
  ];

  const rows: string[] = [headers.map(escapeCSV).join(',')];

  for (const r of reports) {
    rows.push(
      [
        escapeCSV(r.period),
        escapeCSV(r.periodType),
        String(r.year),
        String(r.month || ''),
        String(r.quarter || ''),
        escapeCSV(r.region),
        roundCurrency(Number(r.tpsCollected)).toFixed(2),
        roundCurrency(Number(r.tvqCollected)).toFixed(2),
        roundCurrency(Number(r.tvhCollected)).toFixed(2),
        roundCurrency(Number(r.tpsPaid)).toFixed(2),
        roundCurrency(Number(r.tvqPaid)).toFixed(2),
        roundCurrency(Number(r.tvhPaid)).toFixed(2),
        roundCurrency(Number(r.netTps)).toFixed(2),
        roundCurrency(Number(r.netTvq)).toFixed(2),
        roundCurrency(Number(r.netTvh)).toFixed(2),
        roundCurrency(Number(r.netTotal)).toFixed(2),
        roundCurrency(Number(r.totalSales)).toFixed(2),
        String(r.salesCount),
        escapeCSV(r.status),
        escapeCSV(r.dueDate.toISOString().split('T')[0]),
      ].join(',')
    );
  }

  const dateStr = new Date().toISOString().split('T')[0];
  return {
    csvContent: rows.join('\n'),
    name: `rapports-taxes-${dateStr}.csv`,
  };
}
