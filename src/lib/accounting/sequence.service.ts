/**
 * Sequence Service - Centralized Sequential Number Generation
 *
 * FIX: A002 - Extracts the MAX() + FOR UPDATE pattern into a generic service
 * that handles all sequential number types (JV-, FACT-, NC-, DEP-, FF-).
 *
 * This eliminates race conditions and ensures consistent 5-digit zero-padded
 * format across all accounting document types.
 *
 * Usage:
 *   const num = await generateSequentialNumber(tx, 'JV', 2026);
 *   // Returns: "JV-2026-00001"
 */

import { Prisma } from '@prisma/client';

/**
 * Document type prefixes and their corresponding Prisma tables + columns.
 */
const SEQUENCE_CONFIG: Record<string, { table: string; column: string }> = {
  JV: { table: 'JournalEntry', column: 'entryNumber' },
  FACT: { table: 'CustomerInvoice', column: 'invoiceNumber' },
  NC: { table: 'CreditNote', column: 'creditNoteNumber' },
  DEP: { table: 'Expense', column: 'expenseNumber' },
  FF: { table: 'SupplierInvoice', column: 'internalRef' },
  EST: { table: 'Estimate', column: 'estimateNumber' },
  PO: { table: 'PurchaseOrder', column: 'poNumber' },
};

/**
 * Generate the next sequential number for a given document type and year.
 *
 * MUST be called inside a Prisma $transaction to ensure atomicity via FOR UPDATE.
 * The FOR UPDATE lock prevents two concurrent requests from getting the same number.
 *
 * @param tx - Prisma transaction client
 * @param prefix - Document type prefix (e.g., 'JV', 'FACT', 'DEP')
 * @param year - Fiscal year (e.g., 2026)
 * @param padLength - Number of digits to zero-pad (default: 5)
 * @returns Formatted sequential number (e.g., "JV-2026-00001")
 */
export async function generateSequentialNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
  year?: number,
  padLength: number = 5
): Promise<string> {
  const currentYear = year ?? new Date().getFullYear();
  const fullPrefix = `${prefix}-${currentYear}-`;

  const config = SEQUENCE_CONFIG[prefix];
  if (!config) {
    throw new Error(`Unknown sequence prefix: ${prefix}. Valid prefixes: ${Object.keys(SEQUENCE_CONFIG).join(', ')}`);
  }

  // Use raw query with FOR UPDATE to lock the row with the highest number
  // This serializes concurrent inserts within the same transaction
  const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
    SELECT MAX(${Prisma.raw(`"${config.column}"`)}) as max_num
    FROM ${Prisma.raw(`"${config.table}"`)}
    WHERE ${Prisma.raw(`"${config.column}"`)} LIKE ${fullPrefix + '%'}
    FOR UPDATE
  `;

  let nextSeq = 1;
  if (maxRow?.max_num) {
    const parts = maxRow.max_num.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${fullPrefix}${String(nextSeq).padStart(padLength, '0')}`;
}

/**
 * Convenience wrapper: generate a journal entry number (JV-YYYY-NNNNN)
 */
export async function generateEntryNumber(
  tx: Prisma.TransactionClient,
  year?: number
): Promise<string> {
  return generateSequentialNumber(tx, 'JV', year);
}

/**
 * Convenience wrapper: generate an invoice number (FACT-YYYY-NNNNN)
 */
export async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
  year?: number
): Promise<string> {
  return generateSequentialNumber(tx, 'FACT', year);
}

/**
 * Convenience wrapper: generate an expense number (DEP-YYYY-NNNNN)
 */
export async function generateExpenseNumber(
  tx: Prisma.TransactionClient,
  year?: number
): Promise<string> {
  return generateSequentialNumber(tx, 'DEP', year);
}

/**
 * Convenience wrapper: generate a credit note number (NC-YYYY-NNNNN)
 */
export async function generateCreditNoteNumber(
  tx: Prisma.TransactionClient,
  year?: number
): Promise<string> {
  return generateSequentialNumber(tx, 'NC', year);
}

/**
 * Convenience wrapper: generate a supplier invoice internal ref (FF-YYYY-NNNNN)
 */
export async function generateSupplierInvoiceRef(
  tx: Prisma.TransactionClient,
  year?: number
): Promise<string> {
  return generateSequentialNumber(tx, 'FF', year);
}

/**
 * Convenience wrapper: generate an estimate number (EST-YYYY-NNNNN)
 */
export async function generateEstimateNumber(
  tx: Prisma.TransactionClient,
  year?: number
): Promise<string> {
  return generateSequentialNumber(tx, 'EST', year);
}

/**
 * Convenience wrapper: generate a purchase order number (PO-YYYY-NNNNN)
 */
export async function generatePurchaseOrderNumber(
  tx: Prisma.TransactionClient,
  year?: number
): Promise<string> {
  return generateSequentialNumber(tx, 'PO', year);
}
