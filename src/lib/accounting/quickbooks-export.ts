/**
 * QuickBooks/Xero Export
 * Generate IIF (Intuit Interchange Format) and CSV compatible files
 */

interface ExportEntry {
  date: string; // YYYY-MM-DD
  entryNumber: string;
  description: string;
  lines: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
}

export function generateQuickBooksIIF(entries: ExportEntry[]): string {
  const lines: string[] = [];

  // Header
  lines.push('!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO');
  lines.push('!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO');
  lines.push('!ENDTRNS');

  for (const entry of entries) {
    // Format date as MM/DD/YYYY for QuickBooks
    const [y, m, d] = entry.date.split('-');
    const qbDate = `${m}/${d}/${y}`;

    for (let i = 0; i < entry.lines.length; i++) {
      const line = entry.lines[i];
      const amount = line.debit > 0 ? -line.debit : line.credit;
      const rowType = i === 0 ? 'TRNS' : 'SPL';
      lines.push(`${rowType}\tGENERAL JOURNAL\t${qbDate}\t${line.accountName}\t\t${amount.toFixed(2)}\t${line.description || entry.description}`);
    }
    lines.push('ENDTRNS');
  }

  return lines.join('\n');
}

export function generateXeroCSV(entries: ExportEntry[]): string {
  const rows: string[] = [];
  rows.push('*ContactName,EmailAddress,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxType');

  for (const entry of entries) {
    for (const line of entry.lines) {
      const amount = line.debit > 0 ? line.debit : -line.credit;
      rows.push([
        '', // ContactName
        '', // EmailAddress
        entry.entryNumber,
        entry.date,
        entry.date,
        `"${(line.description || entry.description).replace(/"/g, '""')}"`,
        '1',
        amount.toFixed(2),
        line.accountCode,
        'Tax Exempt',
      ].join(','));
    }
  }

  return rows.join('\n');
}

export function generateGenericCSV(entries: ExportEntry[]): string {
  const rows: string[] = [];
  rows.push('Date,Entry Number,Description,Account Code,Account Name,Debit,Credit');

  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push([
        entry.date,
        entry.entryNumber,
        `"${entry.description.replace(/"/g, '""')}"`,
        line.accountCode,
        `"${line.accountName.replace(/"/g, '""')}"`,
        line.debit.toFixed(2),
        line.credit.toFixed(2),
      ].join(','));
    }
  }

  return rows.join('\n');
}

export type ExportFormat = 'quickbooks_iif' | 'xero_csv' | 'generic_csv';

export function exportEntries(entries: ExportEntry[], format: ExportFormat): { content: string; filename: string; mimeType: string } {
  const dateStr = new Date().toISOString().split('T')[0];
  switch (format) {
    case 'quickbooks_iif':
      return { content: generateQuickBooksIIF(entries), filename: `export-quickbooks-${dateStr}.iif`, mimeType: 'text/plain' };
    case 'xero_csv':
      return { content: generateXeroCSV(entries), filename: `export-xero-${dateStr}.csv`, mimeType: 'text/csv' };
    case 'generic_csv':
    default:
      return { content: generateGenericCSV(entries), filename: `export-comptabilite-${dateStr}.csv`, mimeType: 'text/csv' };
  }
}
