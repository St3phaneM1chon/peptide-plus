/**
 * QuickBooks/Xero Export
 * Generate IIF (Intuit Interchange Format) and CSV compatible files
 * for importing journal entries into external accounting software.
 *
 * Supported formats:
 * - QuickBooks Desktop IIF (Intuit Interchange Format)
 * - Xero Manual Journal CSV
 * - Generic CSV (any accounting software)
 */

import type { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Types - matches Prisma JournalEntry with included lines and accounts
// ---------------------------------------------------------------------------

/** A journal line as returned by Prisma with account included */
export interface ExportJournalLine {
  id: string;
  entryId: string;
  accountId: string;
  description: string | null;
  debit: Decimal | number;
  credit: Decimal | number;
  costCenter: string | null;
  projectCode: string | null;
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
}

/** A journal entry as returned by Prisma with lines included */
export interface ExportJournalEntry {
  id: string;
  entryNumber: string;
  date: Date | string;
  description: string;
  type: string;
  status: string;
  reference: string | null;
  currency: string;
  lines: ExportJournalLine[];
}

// Legacy simplified interface kept for backward compat
interface LegacyExportEntry {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal or number to JS number */
function toNum(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

/** Format a Date or ISO string as YYYY-MM-DD */
function toDateStr(date: Date | string): string {
  if (typeof date === 'string') {
    // Already YYYY-MM-DD or ISO string
    return date.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

/** Format a Date or ISO string as MM/DD/YYYY (QuickBooks format) */
function toQBDate(date: Date | string): string {
  const iso = toDateStr(date);
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

/**
 * CSV formula injection protection + proper escaping.
 * Wraps in quotes if value contains commas, quotes, newlines, or starts
 * with formula-injection characters (=, +, -, @, \t, \r).
 */
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------------------------------------------------------------------------
// Normalise input - accept both new ExportJournalEntry and legacy format
// ---------------------------------------------------------------------------

type AnyEntry = ExportJournalEntry | LegacyExportEntry;

function normaliseLine(line: ExportJournalLine | LegacyExportEntry['lines'][0]) {
  if ('account' in line) {
    // ExportJournalLine (Prisma)
    const l = line as ExportJournalLine;
    return {
      accountCode: l.account.code,
      accountName: l.account.name,
      debit: toNum(l.debit),
      credit: toNum(l.credit),
      description: l.description ?? undefined,
      costCenter: l.costCenter ?? undefined,
      projectCode: l.projectCode ?? undefined,
    };
  }
  // Legacy
  return {
    accountCode: line.accountCode,
    accountName: line.accountName,
    debit: line.debit,
    credit: line.credit,
    description: line.description,
    costCenter: undefined as string | undefined,
    projectCode: undefined as string | undefined,
  };
}

function normaliseEntry(entry: AnyEntry) {
  return {
    entryNumber: entry.entryNumber,
    date: toDateStr(entry.date),
    qbDate: toQBDate(entry.date),
    description: entry.description,
    reference: 'reference' in entry ? (entry as ExportJournalEntry).reference ?? '' : '',
    currency: 'currency' in entry ? (entry as ExportJournalEntry).currency ?? 'CAD' : 'CAD',
    type: 'type' in entry ? (entry as ExportJournalEntry).type ?? '' : '',
    lines: entry.lines.map(normaliseLine),
  };
}

// ---------------------------------------------------------------------------
// QuickBooks IIF Format
// ---------------------------------------------------------------------------

/**
 * Generate a QuickBooks Desktop IIF (Intuit Interchange Format) file.
 *
 * IIF structure:
 * - Header rows define columns with ! prefix (!TRNS, !SPL, !ENDTRNS)
 * - Each transaction starts with a TRNS row (first line of the entry)
 * - Split lines follow as SPL rows
 * - Transaction ends with ENDTRNS
 *
 * Column definitions:
 * TRNSTYPE  - Transaction type (GENERAL JOURNAL)
 * DATE      - MM/DD/YYYY
 * ACCNT     - Account name
 * AMOUNT    - Positive = credit, Negative = debit (QuickBooks convention)
 * MEMO      - Description
 * DOCNUM    - Reference / entry number
 */
export function generateQuickBooksIIF(entries: AnyEntry[]): string {
  const lines: string[] = [];

  // IIF header rows - define column structure
  lines.push('!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\tDOCNUM');
  lines.push('!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\tDOCNUM');
  lines.push('!ENDTRNS');

  for (const raw of entries) {
    const entry = normaliseEntry(raw);
    if (entry.lines.length === 0) continue;

    for (let i = 0; i < entry.lines.length; i++) {
      const line = entry.lines[i];
      // IIF convention: debit = negative amount, credit = positive amount
      const amount = line.debit > 0 ? -line.debit : line.credit;
      const rowType = i === 0 ? 'TRNS' : 'SPL';
      const memo = (line.description || entry.description).replace(/\t/g, ' ');
      lines.push(
        `${rowType}\tGENERAL JOURNAL\t${entry.qbDate}\t${line.accountName}\t\t${amount.toFixed(2)}\t${memo}\t${entry.entryNumber}`
      );
    }
    lines.push('ENDTRNS');
  }

  return lines.join('\r\n'); // IIF uses CRLF
}

// ---------------------------------------------------------------------------
// Xero Manual Journal CSV
// ---------------------------------------------------------------------------

/**
 * Generate a CSV compatible with Xero's "Manual Journal" import.
 *
 * Xero Manual Journal CSV columns:
 * *Narration    - Journal description (required, asterisk = required field)
 * *Date         - DD/MM/YYYY format
 * *AccountCode  - Chart of accounts code
 * Description   - Line-level description
 * Debit         - Debit amount (leave empty if credit)
 * Credit        - Credit amount (leave empty if debit)
 * TaxAmount     - Tax amount (0 for tax-exempt)
 * Reference     - External reference
 */
export function generateXeroCSV(entries: AnyEntry[]): string {
  const rows: string[] = [];
  // Xero Manual Journal headers (asterisk marks required columns)
  rows.push('*Narration,*Date,*AccountCode,Description,Debit,Credit,TaxAmount,Reference');

  for (const raw of entries) {
    const entry = normaliseEntry(raw);
    // Convert YYYY-MM-DD to DD/MM/YYYY for Xero
    const [y, m, d] = entry.date.split('-');
    const xeroDate = `${d}/${m}/${y}`;

    for (const line of entry.lines) {
      rows.push([
        csvEscape(entry.description),
        xeroDate,
        csvEscape(line.accountCode),
        csvEscape(line.description || ''),
        line.debit > 0 ? line.debit.toFixed(2) : '',
        line.credit > 0 ? line.credit.toFixed(2) : '',
        '0.00', // TaxAmount - no tax on journal entries by default
        csvEscape(entry.reference || entry.entryNumber),
      ].join(','));
    }
  }

  return rows.join('\r\n');
}

// ---------------------------------------------------------------------------
// Generic CSV (any accounting software)
// ---------------------------------------------------------------------------

/**
 * Generate a generic CSV suitable for import into most accounting software.
 *
 * Columns: Date, Entry Number, Type, Description, Reference, Account Code,
 *          Account Name, Debit, Credit, Currency, Cost Center, Project Code
 */
export function generateGenericCSV(entries: AnyEntry[]): string {
  const rows: string[] = [];
  rows.push('Date,Entry Number,Type,Description,Reference,Account Code,Account Name,Debit,Credit,Currency,Cost Center,Project Code');

  for (const raw of entries) {
    const entry = normaliseEntry(raw);

    for (const line of entry.lines) {
      rows.push([
        entry.date,
        csvEscape(entry.entryNumber),
        csvEscape(entry.type),
        csvEscape(line.description || entry.description),
        csvEscape(entry.reference),
        csvEscape(line.accountCode),
        csvEscape(line.accountName),
        line.debit > 0 ? line.debit.toFixed(2) : '0.00',
        line.credit > 0 ? line.credit.toFixed(2) : '0.00',
        entry.currency,
        csvEscape(line.costCenter || ''),
        csvEscape(line.projectCode || ''),
      ].join(','));
    }
  }

  return rows.join('\r\n');
}

// ---------------------------------------------------------------------------
// Unified export dispatcher
// ---------------------------------------------------------------------------

export type ExportFormat = 'iif' | 'xero-csv' | 'csv';

// Legacy aliases
export type LegacyExportFormat = 'quickbooks_iif' | 'xero_csv' | 'generic_csv';

const FORMAT_ALIASES: Record<string, ExportFormat> = {
  'quickbooks_iif': 'iif',
  'xero_csv': 'xero-csv',
  'generic_csv': 'csv',
  'iif': 'iif',
  'xero-csv': 'xero-csv',
  'csv': 'csv',
};

export function resolveFormat(raw: string): ExportFormat | null {
  return FORMAT_ALIASES[raw] ?? null;
}

export function exportEntries(
  entries: AnyEntry[],
  format: ExportFormat | LegacyExportFormat
): { content: string; filename: string; mimeType: string; extension: string } {
  const resolved = FORMAT_ALIASES[format] ?? 'csv';
  const dateStr = new Date().toISOString().slice(0, 10);

  switch (resolved) {
    case 'iif':
      return {
        content: generateQuickBooksIIF(entries),
        filename: `journal-export-quickbooks-${dateStr}.iif`,
        mimeType: 'text/plain; charset=utf-8',
        extension: 'iif',
      };
    case 'xero-csv':
      return {
        content: generateXeroCSV(entries),
        filename: `journal-export-xero-${dateStr}.csv`,
        mimeType: 'text/csv; charset=utf-8',
        extension: 'csv',
      };
    case 'csv':
    default:
      return {
        content: generateGenericCSV(entries),
        filename: `journal-export-${dateStr}.csv`,
        mimeType: 'text/csv; charset=utf-8',
        extension: 'csv',
      };
  }
}
