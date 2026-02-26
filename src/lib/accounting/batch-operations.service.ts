/**
 * Batch Operations Service
 * Provides batch processors for bulk accounting actions:
 * - Batch journal entries
 * - Batch invoice status updates
 * - Batch payment recording
 * - Batch expense import
 * - Batch export (CSV/JSON)
 *
 * Each processor validates all items, processes one-by-one within transactions,
 * tracks success/failure per item, and returns a detailed summary.
 */

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { roundCurrency } from '@/lib/financial';
import { generateCSV } from '@/lib/csv-export';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_BATCH_SIZE = 500;

export const BATCH_TYPES = [
  'BATCH_JOURNAL_ENTRIES',
  'BATCH_INVOICES',
  'BATCH_PAYMENTS',
  'BATCH_EXPENSES',
  'BATCH_STATUS_UPDATE',
  'BATCH_EXPORT',
  'BATCH_DELETE',
] as const;

export type BatchType = (typeof BATCH_TYPES)[number];

export const BATCH_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const batchJournalLineSchema = z.object({
  accountId: z.string().min(1, 'accountId requis'),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional(),
});

const batchJournalEntryItemSchema = z.object({
  description: z.string().min(1, 'Description requise').max(500),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  type: z.enum(['MANUAL', 'AUTO_SALE', 'AUTO_REFUND', 'AUTO_STRIPE_FEE', 'AUTO_PAYPAL_FEE', 'AUTO_SHIPPING', 'AUTO_PURCHASE', 'RECURRING', 'ADJUSTMENT', 'CLOSING']).default('MANUAL'),
  reference: z.string().max(100).optional(),
  lines: z.array(batchJournalLineSchema).min(2, 'Minimum 2 lignes requises'),
});

const batchInvoiceStatusItemSchema = z.object({
  invoiceId: z.string().min(1, 'ID facture requis'),
  newStatus: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'VOID', 'CANCELLED']),
});

const batchPaymentItemSchema = z.object({
  invoiceId: z.string().min(1, 'ID facture requis'),
  amount: z.number().positive('Montant positif requis'),
  paymentDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
});

const batchExpenseItemSchema = z.object({
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  description: z.string().min(1, 'Description requise').max(500),
  vendorName: z.string().max(200).optional(),
  subtotal: z.number().min(0, 'Sous-total >= 0'),
  taxGst: z.number().min(0).default(0),
  taxQst: z.number().min(0).default(0),
  taxOther: z.number().min(0).default(0),
  total: z.number().min(0, 'Total >= 0'),
  category: z.string().min(1, 'Catégorie requise'),
  paymentMethod: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const batchExportItemSchema = z.object({
  entityType: z.enum(['JOURNAL_ENTRY', 'EXPENSE', 'INVOICE']),
  format: z.enum(['CSV', 'JSON']).default('CSV'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.string().optional(),
});

export const createBatchJobSchema = z.object({
  type: z.enum(BATCH_TYPES),
  items: z.array(z.unknown()).min(1, 'Au moins un élément requis').max(MAX_BATCH_SIZE, `Maximum ${MAX_BATCH_SIZE} éléments par lot`),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchItemResult {
  index: number;
  success: boolean;
  id?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface BatchSummary {
  jobId: string;
  type: BatchType;
  status: BatchStatus;
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  results: BatchItemResult[];
  errors: Array<{ index: number; error: string }>;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Helper: Generate sequential entry number in a transaction
// ---------------------------------------------------------------------------

async function generateEntryNumberInTx(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JE-${year}-`;

  const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
    SELECT MAX("entryNumber") as max_num
    FROM "JournalEntry"
    WHERE "entryNumber" LIKE ${prefix + '%'}
    FOR UPDATE
  `;

  let nextSeq = 1;
  if (maxRow?.max_num) {
    const parts = maxRow.max_num.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

async function generateExpenseNumberInTx(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEP-${year}-`;

  const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
    SELECT MAX("expenseNumber") as max_num
    FROM "Expense"
    WHERE "expenseNumber" LIKE ${prefix + '%'}
    FOR UPDATE
  `;

  let nextSeq = 1;
  if (maxRow?.max_num) {
    const parts = maxRow.max_num.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Batch Processors
// ---------------------------------------------------------------------------

/**
 * Process batch journal entries.
 * Creates multiple journal entries from an array. Each entry is validated
 * individually and processed in its own transaction.
 */
async function processBatchJournalEntries(
  items: unknown[],
  jobId: string,
  createdBy: string | null
): Promise<BatchItemResult[]> {
  const results: BatchItemResult[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const parsed = batchJournalEntryItemSchema.safeParse(items[i]);
      if (!parsed.success) {
        const errorMsg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        results.push({ index: i, success: false, error: `Validation: ${errorMsg}` });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      const data = parsed.data;

      // Validate balance
      const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
      if (roundCurrency(totalDebit - totalCredit) !== 0) {
        results.push({
          index: i,
          success: false,
          error: `Débit (${totalDebit}) et crédit (${totalCredit}) non équilibrés`,
        });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      // Create entry in transaction
      const entry = await prisma.$transaction(async (tx) => {
        const entryNumber = await generateEntryNumberInTx(tx);

        const created = await tx.journalEntry.create({
          data: {
            entryNumber,
            description: data.description,
            date: new Date(data.date),
            type: data.type as Prisma.EnumJournalEntryTypeFieldUpdateOperationsInput['set'],
            reference: data.reference || null,
            createdBy: createdBy || 'batch-import',
            lines: {
              create: data.lines.map((line) => ({
                accountId: line.accountId,
                debit: new Prisma.Decimal(line.debit),
                credit: new Prisma.Decimal(line.credit),
                description: line.description || null,
              })),
            },
          },
          select: { id: true, entryNumber: true },
        });

        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      results.push({
        index: i,
        success: true,
        id: entry.id,
        data: { entryNumber: entry.entryNumber },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Batch journal entry error', { index: i, jobId, error: msg });
      results.push({ index: i, success: false, error: msg });
    }

    await updateJobProgress(jobId, i + 1, results);
  }

  return results;
}

/**
 * Process batch invoice status updates.
 * Updates the status of multiple customer invoices at once.
 */
async function processBatchInvoiceStatusUpdate(
  items: unknown[],
  jobId: string,
  _createdBy: string | null
): Promise<BatchItemResult[]> {
  const results: BatchItemResult[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const parsed = batchInvoiceStatusItemSchema.safeParse(items[i]);
      if (!parsed.success) {
        const errorMsg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        results.push({ index: i, success: false, error: `Validation: ${errorMsg}` });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      const { invoiceId, newStatus } = parsed.data;

      // Find invoice
      const invoice = await prisma.customerInvoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, invoiceNumber: true, status: true },
      });

      if (!invoice) {
        results.push({ index: i, success: false, error: `Facture ${invoiceId} introuvable` });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      // Update status
      await prisma.customerInvoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus as Prisma.EnumInvoiceStatusFieldUpdateOperationsInput['set'],
          ...(newStatus === 'PAID' ? { paidAt: new Date() } : {}),
        },
      });

      results.push({
        index: i,
        success: true,
        id: invoiceId,
        data: { invoiceNumber: invoice.invoiceNumber, oldStatus: invoice.status, newStatus },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Batch invoice status update error', { index: i, jobId, error: msg });
      results.push({ index: i, success: false, error: msg });
    }

    await updateJobProgress(jobId, i + 1, results);
  }

  return results;
}

/**
 * Process batch payment recording.
 * Records payments for multiple invoices.
 */
async function processBatchPayments(
  items: unknown[],
  jobId: string,
  _createdBy: string | null
): Promise<BatchItemResult[]> {
  const results: BatchItemResult[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const parsed = batchPaymentItemSchema.safeParse(items[i]);
      if (!parsed.success) {
        const errorMsg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        results.push({ index: i, success: false, error: `Validation: ${errorMsg}` });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      const { invoiceId, amount } = parsed.data;

      // Find invoice
      const invoice = await prisma.customerInvoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, invoiceNumber: true, status: true, total: true, amountPaid: true },
      });

      if (!invoice) {
        results.push({ index: i, success: false, error: `Facture ${invoiceId} introuvable` });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      if (invoice.status === 'VOID' || invoice.status === 'CANCELLED') {
        results.push({ index: i, success: false, error: `Facture ${invoice.invoiceNumber} est ${invoice.status}` });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      const currentPaid = Number(invoice.amountPaid || 0);
      const invoiceTotal = Number(invoice.total);
      const newPaid = currentPaid + amount;

      // Update invoice
      const isFullyPaid = newPaid >= invoiceTotal;
      await prisma.customerInvoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: new Prisma.Decimal(newPaid),
          balance: new Prisma.Decimal(invoiceTotal - newPaid),
          status: isFullyPaid ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'SENT'),
          paidAt: isFullyPaid ? new Date() : undefined,
        },
      });

      results.push({
        index: i,
        success: true,
        id: invoiceId,
        data: {
          invoiceNumber: invoice.invoiceNumber,
          amount,
          totalPaid: newPaid,
          invoiceTotal,
          fullyPaid: isFullyPaid,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Batch payment error', { index: i, jobId, error: msg });
      results.push({ index: i, success: false, error: msg });
    }

    await updateJobProgress(jobId, i + 1, results);
  }

  return results;
}

/**
 * Process batch expense import.
 * Creates multiple expenses from CSV-parsed data.
 */
async function processBatchExpenses(
  items: unknown[],
  jobId: string,
  createdBy: string | null
): Promise<BatchItemResult[]> {
  const results: BatchItemResult[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const parsed = batchExpenseItemSchema.safeParse(items[i]);
      if (!parsed.success) {
        const errorMsg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        results.push({ index: i, success: false, error: `Validation: ${errorMsg}` });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      const data = parsed.data;

      // Validate total = subtotal + taxes
      const computedTotal = data.subtotal + data.taxGst + data.taxQst + data.taxOther;
      if (Math.abs(computedTotal - data.total) > 0.01) {
        results.push({
          index: i,
          success: false,
          error: `Total (${data.total}) ne correspond pas au sous-total + taxes (${computedTotal.toFixed(2)})`,
        });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      const expense = await prisma.$transaction(async (tx) => {
        const expenseNumber = await generateExpenseNumberInTx(tx);

        return tx.expense.create({
          data: {
            expenseNumber,
            date: new Date(data.date),
            description: data.description,
            subtotal: new Prisma.Decimal(data.subtotal),
            taxGst: new Prisma.Decimal(data.taxGst),
            taxQst: new Prisma.Decimal(data.taxQst),
            taxOther: new Prisma.Decimal(data.taxOther),
            total: new Prisma.Decimal(data.total),
            category: data.category,
            vendorName: data.vendorName || null,
            paymentMethod: data.paymentMethod || null,
            notes: data.notes || null,
            submittedBy: createdBy || null,
          },
          select: { id: true, expenseNumber: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      results.push({
        index: i,
        success: true,
        id: expense.id,
        data: { expenseNumber: expense.expenseNumber },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Batch expense error', { index: i, jobId, error: msg });
      results.push({ index: i, success: false, error: msg });
    }

    await updateJobProgress(jobId, i + 1, results);
  }

  return results;
}

/**
 * Process batch export.
 * Exports selected records to CSV or JSON format.
 */
async function processBatchExport(
  items: unknown[],
  jobId: string,
  _createdBy: string | null
): Promise<BatchItemResult[]> {
  const results: BatchItemResult[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const parsed = batchExportItemSchema.safeParse(items[i]);
      if (!parsed.success) {
        const errorMsg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        results.push({ index: i, success: false, error: `Validation: ${errorMsg}` });
        await updateJobProgress(jobId, i + 1, results);
        continue;
      }

      const { entityType, format, dateFrom, dateTo, status } = parsed.data;

      let exportData: string;
      let recordCount = 0;

      if (entityType === 'JOURNAL_ENTRY') {
        const where: Prisma.JournalEntryWhereInput = {};
        if (dateFrom || dateTo) {
          where.date = {};
          if (dateFrom) where.date.gte = new Date(dateFrom);
          if (dateTo) where.date.lte = new Date(dateTo);
        }
        if (status) where.status = status as Prisma.EnumJournalEntryStatusFilter;

        const entries = await prisma.journalEntry.findMany({
          where,
          include: { lines: { include: { account: { select: { code: true, name: true } } } } },
          orderBy: { date: 'desc' },
          take: MAX_BATCH_SIZE,
        });
        recordCount = entries.length;

        if (format === 'CSV') {
          const headers = ['Numero', 'Date', 'Description', 'Type', 'Reference', 'Statut', 'Debit Total', 'Credit Total'];
          const rows = entries.map((e) => {
            const debitSum = e.lines.reduce((s, l) => s + Number(l.debit), 0);
            const creditSum = e.lines.reduce((s, l) => s + Number(l.credit), 0);
            return [
              e.entryNumber,
              e.date.toISOString().split('T')[0],
              e.description,
              e.type,
              e.reference || '',
              e.status,
              String(debitSum),
              String(creditSum),
            ];
          });
          exportData = generateCSV(headers, rows);
        } else {
          exportData = JSON.stringify(entries.map((e) => ({
            ...e,
            lines: e.lines.map((l) => ({
              ...l,
              debit: Number(l.debit),
              credit: Number(l.credit),
            })),
          })), null, 2);
        }
      } else if (entityType === 'EXPENSE') {
        const where: Prisma.ExpenseWhereInput = { deletedAt: null };
        if (dateFrom || dateTo) {
          where.date = {};
          if (dateFrom) where.date.gte = new Date(dateFrom);
          if (dateTo) where.date.lte = new Date(dateTo);
        }
        if (status) where.status = status as Prisma.EnumExpenseStatusFilter;

        const expenses = await prisma.expense.findMany({
          where,
          orderBy: { date: 'desc' },
          take: MAX_BATCH_SIZE,
        });
        recordCount = expenses.length;

        if (format === 'CSV') {
          const headers = ['Numéro', 'Date', 'Description', 'Fournisseur', 'Sous-total', 'TPS', 'TVQ', 'Autre taxe', 'Total', 'Catégorie', 'Statut'];
          const rows = expenses.map((e) => [
            e.expenseNumber,
            e.date.toISOString().split('T')[0],
            e.description,
            e.vendorName || '',
            String(Number(e.subtotal)),
            String(Number(e.taxGst)),
            String(Number(e.taxQst)),
            String(Number(e.taxOther)),
            String(Number(e.total)),
            e.category,
            e.status,
          ]);
          exportData = generateCSV(headers, rows);
        } else {
          exportData = JSON.stringify(expenses.map((e) => ({
            ...e,
            subtotal: Number(e.subtotal),
            taxGst: Number(e.taxGst),
            taxQst: Number(e.taxQst),
            taxOther: Number(e.taxOther),
            total: Number(e.total),
          })), null, 2);
        }
      } else {
        // INVOICE
        const where: Prisma.CustomerInvoiceWhereInput = {};
        if (dateFrom || dateTo) {
          where.invoiceDate = {};
          if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
          if (dateTo) where.invoiceDate.lte = new Date(dateTo);
        }
        if (status) where.status = status as Prisma.EnumInvoiceStatusFilter;

        const invoices = await prisma.customerInvoice.findMany({
          where,
          orderBy: { invoiceDate: 'desc' },
          take: MAX_BATCH_SIZE,
        });
        recordCount = invoices.length;

        if (format === 'CSV') {
          const headers = ['Numero', 'Date', 'Client', 'Sous-total', 'TPS', 'TVQ', 'Total', 'Statut', 'Echeance'];
          const rows = invoices.map((inv) => [
            inv.invoiceNumber,
            inv.invoiceDate.toISOString().split('T')[0],
            inv.customerName,
            String(Number(inv.subtotal)),
            String(Number(inv.taxTps)),
            String(Number(inv.taxTvq)),
            String(Number(inv.total)),
            inv.status,
            inv.dueDate.toISOString().split('T')[0],
          ]);
          exportData = generateCSV(headers, rows);
        } else {
          exportData = JSON.stringify(invoices.map((inv) => ({
            ...inv,
            subtotal: Number(inv.subtotal),
            taxTps: Number(inv.taxTps),
            taxTvq: Number(inv.taxTvq),
            taxTvh: Number(inv.taxTvh),
            total: Number(inv.total),
            amountPaid: Number(inv.amountPaid),
          })), null, 2);
        }
      }

      results.push({
        index: i,
        success: true,
        data: {
          entityType,
          format,
          recordCount,
          exportData,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Batch export error', { index: i, jobId, error: msg });
      results.push({ index: i, success: false, error: msg });
    }

    await updateJobProgress(jobId, i + 1, results);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Job Progress Updater
// ---------------------------------------------------------------------------

async function updateJobProgress(
  jobId: string,
  processedItems: number,
  results: BatchItemResult[]
): Promise<void> {
  try {
    const successItems = results.filter((r) => r.success).length;
    const failedItems = results.filter((r) => !r.success).length;

    await prisma.batchJob.update({
      where: { id: jobId },
      data: { processedItems, successItems, failedItems },
    });
  } catch (error) {
    // Non-blocking: progress update failure should not stop the batch
    logger.warn('Failed to update batch job progress', { jobId, error: String(error) });
  }
}

// ---------------------------------------------------------------------------
// Main Batch Executor
// ---------------------------------------------------------------------------

/**
 * Execute a batch job. Creates the job record, processes items, and returns
 * a detailed summary.
 */
export async function executeBatchJob(
  type: BatchType,
  items: unknown[],
  createdBy: string | null
): Promise<BatchSummary> {
  // Validate batch size
  if (items.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum ${MAX_BATCH_SIZE} éléments par lot (reçu: ${items.length})`);
  }

  if (items.length === 0) {
    throw new Error('Au moins un élément requis');
  }

  // Create job record
  const job = await prisma.batchJob.create({
    data: {
      type,
      status: 'PROCESSING',
      totalItems: items.length,
      inputData: JSON.stringify(items),
      createdBy,
      startedAt: new Date(),
    },
  });

  const startTime = Date.now();

  let results: BatchItemResult[] = [];

  try {
    // Dispatch to the appropriate processor
    switch (type) {
      case 'BATCH_JOURNAL_ENTRIES':
        results = await processBatchJournalEntries(items, job.id, createdBy);
        break;
      case 'BATCH_STATUS_UPDATE':
      case 'BATCH_INVOICES':
        results = await processBatchInvoiceStatusUpdate(items, job.id, createdBy);
        break;
      case 'BATCH_PAYMENTS':
        results = await processBatchPayments(items, job.id, createdBy);
        break;
      case 'BATCH_EXPENSES':
        results = await processBatchExpenses(items, job.id, createdBy);
        break;
      case 'BATCH_EXPORT':
        results = await processBatchExport(items, job.id, createdBy);
        break;
      case 'BATCH_DELETE':
        // Delete is handled as a status update (void/cancel) for safety
        results = await processBatchInvoiceStatusUpdate(items, job.id, createdBy);
        break;
      default:
        throw new Error(`Type de lot non supporté: ${type}`);
    }

    const successItems = results.filter((r) => r.success).length;
    const failedItems = results.filter((r) => !r.success).length;
    const errors = results.filter((r) => !r.success).map((r) => ({ index: r.index, error: r.error || 'Erreur inconnue' }));

    const completedAt = new Date();
    const status: BatchStatus = failedItems === items.length ? 'FAILED' : 'COMPLETED';

    // Update job record with final results
    await prisma.batchJob.update({
      where: { id: job.id },
      data: {
        status,
        processedItems: items.length,
        successItems,
        failedItems,
        resultData: JSON.stringify(results),
        errorLog: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt,
      },
    });

    const durationMs = Date.now() - startTime;

    logger.info('Batch job completed', {
      jobId: job.id,
      type,
      totalItems: items.length,
      successItems,
      failedItems,
      durationMs,
    });

    return {
      jobId: job.id,
      type,
      status,
      totalItems: items.length,
      processedItems: items.length,
      successItems,
      failedItems,
      results,
      errors,
      startedAt: job.startedAt!.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Mark job as failed
    await prisma.batchJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorLog: JSON.stringify([{ error: errorMessage }]),
        completedAt: new Date(),
      },
    });

    logger.error('Batch job failed', { jobId: job.id, type, error: errorMessage });

    throw error;
  }
}

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

/**
 * Parse CSV content into an array of objects.
 * Handles BOM, various line endings, and quoted fields.
 */
export function parseCSV(csvContent: string): Record<string, string>[] {
  // Remove BOM if present
  let content = csvContent;
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  // Normalize line endings
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = parseCSVLines(content);
  if (lines.length < 2) {
    throw new Error('Le fichier CSV doit contenir au moins un en-tête et une ligne de données');
  }

  const headers = lines[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    // Skip empty lines
    if (values.length === 1 && values[0].trim() === '') continue;

    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (values[j] || '').trim();
    }
    records.push(record);
  }

  return records;
}

/**
 * Parse CSV content respecting quoted fields.
 */
function parseCSVLines(content: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentLine.push(currentField);
        currentField = '';
      } else if (ch === '\n') {
        currentLine.push(currentField);
        currentField = '';
        lines.push(currentLine);
        currentLine = [];
      } else {
        currentField += ch;
      }
    }
  }

  // Push last field and line
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField);
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Transform parsed CSV records to batch expense items.
 * Maps CSV column names to the expected schema fields.
 */
export function csvToExpenseItems(records: Record<string, string>[]): unknown[] {
  return records.map((row) => ({
    date: row['date'] || row['Date'] || row['DATE'] || '',
    description: row['description'] || row['Description'] || row['DESCRIPTION'] || '',
    vendorName: row['vendor'] || row['vendorName'] || row['Vendor'] || row['Fournisseur'] || '',
    subtotal: parseFloat(row['subtotal'] || row['Subtotal'] || row['Sous-total'] || row['amount'] || row['Amount'] || row['Montant'] || '0'),
    taxGst: parseFloat(row['taxGst'] || row['TPS'] || row['gst'] || row['GST'] || '0'),
    taxQst: parseFloat(row['taxQst'] || row['TVQ'] || row['qst'] || row['QST'] || '0'),
    taxOther: parseFloat(row['taxOther'] || row['Autre taxe'] || row['otherTax'] || '0'),
    total: parseFloat(row['total'] || row['Total'] || row['TOTAL'] || '0'),
    category: row['category'] || row['Category'] || row['Catégorie'] || row['CATEGORY'] || 'office',
    paymentMethod: row['paymentMethod'] || row['Payment Method'] || row['Mode de paiement'] || '',
    notes: row['notes'] || row['Notes'] || row['NOTES'] || '',
  }));
}

/**
 * Transform parsed CSV records to batch journal entry items.
 * Each row represents a journal line. Lines are grouped by entry (same date + description).
 */
export function csvToJournalEntryItems(records: Record<string, string>[]): unknown[] {
  // Group by date + description combo to form entries
  const groups = new Map<string, { description: string; date: string; reference: string; lines: Array<{ accountId: string; debit: number; credit: number; description: string }> }>();

  for (const row of records) {
    const date = row['date'] || row['Date'] || row['DATE'] || '';
    const description = row['description'] || row['Description'] || row['DESCRIPTION'] || '';
    const key = `${date}|${description}`;

    if (!groups.has(key)) {
      groups.set(key, {
        description,
        date,
        reference: row['reference'] || row['Reference'] || row['Référence'] || '',
        lines: [],
      });
    }

    groups.get(key)!.lines.push({
      accountId: row['accountId'] || row['Account ID'] || row['Compte'] || '',
      debit: parseFloat(row['debit'] || row['Debit'] || row['Débit'] || '0'),
      credit: parseFloat(row['credit'] || row['Credit'] || row['Crédit'] || '0'),
      description: row['lineDescription'] || row['Line Description'] || row['Description ligne'] || '',
    });
  }

  return Array.from(groups.values()).map((g) => ({
    description: g.description,
    date: g.date,
    reference: g.reference || undefined,
    lines: g.lines,
  }));
}

// ---------------------------------------------------------------------------
// CSV Templates
// ---------------------------------------------------------------------------

/**
 * Generate CSV template content for download.
 */
export function getCSVTemplate(templateType: string): { content: string; filename: string } {
  const BOM = '\uFEFF';

  switch (templateType) {
    case 'expenses':
      return {
        content: BOM + 'date,description,vendor,subtotal,taxGst,taxQst,taxOther,total,category,paymentMethod,notes\n'
          + '2026-01-15,Fournitures bureau,Staples,100.00,5.00,9.975,0,114.98,office,credit_card,Achat mensuel\n'
          + '2026-01-20,Repas client,Restaurant ABC,50.00,2.50,4.99,0,57.49,meals,credit_card,Déjeuner client',
        filename: 'template-depenses.csv',
      };
    case 'journal_entries':
      return {
        content: BOM + 'date,description,reference,accountId,debit,credit,lineDescription\n'
          + '2026-01-15,Vente produits,VENTE-001,account-id-1,1000.00,0,Débit caisse\n'
          + '2026-01-15,Vente produits,VENTE-001,account-id-2,0,1000.00,Crédit ventes',
        filename: 'template-ecritures.csv',
      };
    case 'invoices':
      return {
        content: BOM + 'invoiceId,newStatus\n'
          + 'invoice-id-1,SENT\n'
          + 'invoice-id-2,PAID',
        filename: 'template-factures-statut.csv',
      };
    default:
      throw new Error(`Template type non supporté: ${templateType}`);
  }
}
