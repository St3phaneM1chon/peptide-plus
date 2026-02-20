import { z } from 'zod';
import { roundCurrency } from '@/lib/financial';

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
export const createExpenseSchema = z.object({
  description: z.string().min(1, 'Description requise').max(500),
  amount: z.number().positive('Montant doit être positif'),
  category: z.string().min(1, 'Catégorie requise'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  vendor: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  taxDeductible: z.boolean().default(false),
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
