import { z } from 'zod';
import { roundCurrency } from '@/lib/financial';
import { prisma } from '@/lib/db';

// FIX: F090 - Note: API routes accept accountCode (string), services resolve to accountId (UUID).
// Schemas use accountId for validated objects. Document convention clearly.

// ---- Journal Entries ----
export const journalLineSchema = z.object({
  accountId: z.string().min(1, 'accountId requis'),
  debit: z.number().min(0, 'debit >= 0').default(0),
  credit: z.number().min(0, 'credit >= 0').default(0),
  description: z.string().optional(),
});

export const createJournalEntrySchema = z.object({
  description: z.string().min(1, 'Description requise').max(500),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  type: z.enum(['MANUAL', 'AUTOMATIC', 'CLOSING', 'ADJUSTMENT', 'CORRECTION']).default('MANUAL'),
  reference: z.string().max(100).optional(),
  lines: z.array(journalLineSchema).min(2, 'Minimum 2 lignes requises'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
    return roundCurrency(totalDebit - totalCredit) === 0;
  },
  { message: 'Les débits et crédits doivent être équilibrés' }
);

export const updateJournalEntrySchema = z.object({
  id: z.string().min(1, 'ID requis'),
  description: z.string().min(1).max(500).optional(),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide').optional(),
  reference: z.string().max(100).optional(),
  lines: z.array(journalLineSchema).min(2).optional(),
  updatedAt: z.string().optional(), // for optimistic locking
}).refine(
  (data) => {
    if (!data.lines) return true;
    const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
    return roundCurrency(totalDebit - totalCredit) === 0;
  },
  { message: 'Les débits et crédits doivent être équilibrés' }
);

/**
 * Assert that journal entry lines are balanced (sum(debit) === sum(credit)).
 * Use this as a runtime guard before any journal entry insertion.
 * Throws an error if lines are unbalanced.
 */
export function assertJournalBalance(
  lines: Array<{ debit: number; credit: number }>,
  context?: string
): void {
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (roundCurrency(totalDebit - totalCredit) !== 0) {
    const ctx = context ? ` (${context})` : '';
    throw new Error(
      `Journal entry unbalanced${ctx}: debit=${roundCurrency(totalDebit)}, credit=${roundCurrency(totalCredit)}, diff=${roundCurrency(totalDebit - totalCredit)}`
    );
  }
}

/**
 * Assert that the accounting period covering `transactionDate` is open.
 * Throws an error if the period is CLOSED or LOCKED, preventing writes
 * to locked accounting periods.
 */
export async function assertPeriodOpen(transactionDate: Date): Promise<void> {
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      startDate: { lte: transactionDate },
      endDate: { gte: transactionDate },
    },
    select: { id: true, code: true, status: true },
  });

  if (period && (period.status === 'CLOSED' || period.status === 'LOCKED')) {
    throw new Error(
      `Accounting period ${period.code} is ${period.status}. Cannot write to a locked/closed period.`
    );
  }
}

// ---- Customer Invoices ----
export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description requise'),
  quantity: z.number().min(1, 'Quantité >= 1'),
  unitPrice: z.number().min(0, 'Prix >= 0'),
  discount: z.number().min(0).default(0),
});

export const createCustomerInvoiceSchema = z.object({
  customerName: z.string().min(1, 'Nom du client requis'),
  customerEmail: z.string().email('Email invalide').optional(),
  customerAddress: z.string().max(500).optional(),
  items: z.array(invoiceItemSchema).min(1, 'Au moins un article requis'),
  taxTps: z.number().min(0).default(0),
  taxTvq: z.number().min(0).default(0),
  taxTvh: z.number().min(0).default(0),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  notes: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'SENT']).default('DRAFT'),
});

// ---- Expenses ----
// FIX: F017 - Consolidated expense validation schema. This is the single source of truth
// for expense creation validation. The route at /api/accounting/expenses/route.ts imports
// this schema. The previous version here was outdated and inconsistent with the route.
export const createExpenseSchema = z.object({
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  description: z.string().min(1, 'Description requise').max(500),
  subtotal: z.number().min(0, 'Le sous-total doit être positif'),
  taxGst: z.number().min(0).default(0),
  taxQst: z.number().min(0).default(0),
  taxOther: z.number().min(0).default(0),
  total: z.number().min(0, 'Le total doit être positif'),
  category: z.string().min(1, 'Catégorie requise'),
  accountId: z.string().optional().nullable(),
  vendorName: z.string().max(200).optional().nullable(),
  vendorTaxNumber: z.string().max(50).optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  mileageKm: z.number().min(0).optional().nullable(),
  mileageRate: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateExpenseSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide').optional(),
  description: z.string().min(1).max(500).optional(),
  subtotal: z.number().min(0).optional(),
  taxGst: z.number().min(0).optional(),
  taxQst: z.number().min(0).optional(),
  taxOther: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  category: z.string().min(1).optional(),
  accountId: z.string().optional().nullable(),
  vendorName: z.string().max(200).optional().nullable(),
  vendorTaxNumber: z.string().max(50).optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  mileageKm: z.number().min(0).optional().nullable(),
  mileageRate: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED']).optional(),
  rejectionReason: z.string().max(500).optional().nullable(),
});

// ---- Budgets ----
export const createBudgetSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(200),
  accountId: z.string().min(1, 'Compte requis'),
  amount: z.number().positive('Montant doit être positif'),
  periodStart: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  periodEnd: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
});

// ---- Helper to format Zod errors ----
export function formatZodErrors(error: z.ZodError): string {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
}
