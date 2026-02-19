/**
 * Payment Matching Service
 * Match bank transactions to invoices, apply payments, and suggest unmatched items.
 *
 * Phase 10 - Advanced Features
 */

import { prisma } from '@/lib/db';
import { logAuditTrail } from './audit-trail.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentMatch {
  bankTransactionId: string;
  bankDate: Date;
  bankAmount: number;
  bankDescription: string;
  bankReference: string | null;
  confidence: number; // 0-100
  matchReasons: string[];
}

export interface MatchResult {
  success: boolean;
  journalEntryId?: string;
  message: string;
}

export interface UnmatchedSuggestion {
  bankTransactionId: string;
  bankDate: Date;
  bankAmount: number;
  bankDescription: string;
  suggestedInvoices: {
    invoiceId: string;
    invoiceNumber: string;
    total: number;
    dueDate: Date;
    confidence: number;
  }[];
}

// ---------------------------------------------------------------------------
// Find Payment Matches
// ---------------------------------------------------------------------------

/**
 * Search bank transactions that could match a given customer invoice.
 * Match criteria:
 *   - Amount: exact match or within 1%
 *   - Date: within 30 days of invoice due date
 *   - Reference: bank reference or description contains invoice number
 * Returns matches sorted by confidence score (highest first).
 */
export async function findPaymentMatches(invoiceId: string): Promise<PaymentMatch[]> {
  const invoice = await prisma.customerInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      balance: true,
      dueDate: true,
      status: true,
    },
  });

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  const invoiceBalance = Number(invoice.balance);
  const invoiceTotal = Number(invoice.total);
  const amountToMatch = invoiceBalance > 0 ? invoiceBalance : invoiceTotal;

  // Date window: 30 days before and after due date
  const dateWindowStart = new Date(invoice.dueDate);
  dateWindowStart.setDate(dateWindowStart.getDate() - 30);
  const dateWindowEnd = new Date(invoice.dueDate);
  dateWindowEnd.setDate(dateWindowEnd.getDate() + 30);

  // Fetch unreconciled bank transactions (positive amounts = deposits)
  const candidates = await prisma.bankTransaction.findMany({
    where: {
      reconciliationStatus: 'PENDING',
      deletedAt: null,
      amount: { gt: 0 },
      date: {
        gte: dateWindowStart,
        lte: dateWindowEnd,
      },
    },
    orderBy: { date: 'desc' },
    take: 100,
  });

  const matches: PaymentMatch[] = [];

  for (const tx of candidates) {
    const txAmount = Number(tx.amount);
    const reasons: string[] = [];
    let score = 0;

    // Criterion 1: Amount match (exact or within 1%)
    const amountDiff = Math.abs(txAmount - amountToMatch);
    const amountThreshold = amountToMatch * 0.01;

    if (amountDiff === 0) {
      score += 50;
      reasons.push('Montant exact');
    } else if (amountDiff <= amountThreshold) {
      score += 35;
      reasons.push(`Montant proche (${"\u00B1"}${(amountDiff / amountToMatch * 100).toFixed(2)}%)`);
    }

    // Criterion 2: Date proximity
    const daysDiff = Math.abs(
      Math.round((tx.date.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
    if (daysDiff <= 3) {
      score += 25;
      reasons.push("Date très proche de l'échéance");
    } else if (daysDiff <= 7) {
      score += 20;
      reasons.push("Date proche de l'échéance");
    } else if (daysDiff <= 14) {
      score += 10;
      reasons.push("Date dans les 14 jours de l'échéance");
    } else {
      score += 5;
      reasons.push('Date dans la fenêtre de 30 jours');
    }

    // Criterion 3: Reference contains invoice number
    const searchFields = [
      (tx.reference ?? '').toUpperCase(),
      tx.description.toUpperCase(),
    ];
    const invoiceNum = invoice.invoiceNumber.toUpperCase();

    for (const field of searchFields) {
      if (field.includes(invoiceNum)) {
        score += 25;
        reasons.push(`Référence contient ${invoice.invoiceNumber}`);
        break;
      }
    }

    // Only include if minimum confidence
    if (score >= 20) {
      matches.push({
        bankTransactionId: tx.id,
        bankDate: tx.date,
        bankAmount: txAmount,
        bankDescription: tx.description,
        bankReference: tx.reference,
        confidence: Math.min(score, 100),
        matchReasons: reasons,
      });
    }
  }

  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches;
}

// ---------------------------------------------------------------------------
// Apply Payment Match
// ---------------------------------------------------------------------------

/**
 * Apply a payment match: create journal entry, mark invoice paid, reconcile bank tx.
 */
export async function applyPaymentMatch(
  invoiceId: string,
  bankTxId: string,
  userId: string = 'system',
): Promise<MatchResult> {
  const [invoice, bankTx] = await Promise.all([
    prisma.customerInvoice.findUnique({ where: { id: invoiceId } }),
    prisma.bankTransaction.findUnique({ where: { id: bankTxId } }),
  ]);

  if (!invoice) {
    return { success: false, message: `Facture non trouvée: ${invoiceId}` };
  }
  if (!bankTx) {
    return { success: false, message: `Transaction bancaire non trouvée: ${bankTxId}` };
  }
  if (bankTx.reconciliationStatus !== 'PENDING') {
    return { success: false, message: 'Transaction bancaire déjà rapprochée' };
  }

  const paymentAmount = Number(bankTx.amount);

  // Find chart of accounts
  const [arAccount, cashAccount] = await Promise.all([
    prisma.chartOfAccount.findFirst({
      where: { code: { startsWith: '11' }, type: 'ASSET', isActive: true },
      select: { id: true },
    }),
    prisma.chartOfAccount.findFirst({
      where: { code: { startsWith: '10' }, type: 'ASSET', isActive: true },
      select: { id: true },
    }),
  ]);

  if (!arAccount || !cashAccount) {
    return { success: false, message: 'Comptes comptables (débiteurs/banque) introuvables' };
  }

  // Generate entry number
  const year = new Date().getFullYear();
  const prefix = `JV-${year}-`;
  const lastEntry = await prisma.journalEntry.findFirst({
    where: { entryNumber: { startsWith: prefix } },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  });
  const nextNum = lastEntry
    ? String(parseInt(lastEntry.entryNumber.replace(prefix, ''), 10) + 1).padStart(5, '0')
    : '00001';
  const entryNumber = `${prefix}${nextNum}`;

  // Create journal entry + update invoice + reconcile bank tx in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create journal entry: Debit Cash, Credit Accounts Receivable
    const entry = await tx.journalEntry.create({
      data: {
        id: crypto.randomUUID(),
        entryNumber,
        date: bankTx.date,
        description: `Paiement reçu - Facture ${invoice.invoiceNumber}`,
        type: 'AUTO_SALE',
        status: 'POSTED',
        reference: `PMT-${invoice.invoiceNumber}`,
        postedAt: new Date(),
        postedBy: userId,
        createdBy: userId,
        updatedAt: new Date(),
        lines: {
          create: [
            {
              id: crypto.randomUUID(),
              accountId: cashAccount.id,
              description: `Dépôt bancaire - ${bankTx.description}`,
              debit: paymentAmount,
              credit: 0,
            },
            {
              id: crypto.randomUUID(),
              accountId: arAccount.id,
              description: `Paiement facture ${invoice.invoiceNumber}`,
              debit: 0,
              credit: paymentAmount,
            },
          ],
        },
      },
    });

    // 2. Update invoice
    const newAmountPaid = Number(invoice.amountPaid) + paymentAmount;
    const newBalance = Number(invoice.total) - newAmountPaid;
    const isFullyPaid = newBalance <= 0.01;

    await tx.customerInvoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        balance: Math.max(0, newBalance),
        status: isFullyPaid ? 'PAID' : 'PARTIAL',
        paidAt: isFullyPaid ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });

    // 3. Reconcile bank transaction
    await tx.bankTransaction.update({
      where: { id: bankTxId },
      data: {
        reconciliationStatus: 'MATCHED',
        matchedEntryId: entry.id,
        matchedAt: new Date(),
        matchedBy: userId,
      },
    });

    return entry;
  });

  // 4. Audit trail (outside transaction, non-blocking)
  try {
    await logAuditTrail({
      action: 'RECONCILE',
      entityType: 'CUSTOMER_INVOICE',
      entityId: invoiceId,
      userId,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        bankTransactionId: bankTxId,
        amount: paymentAmount,
        journalEntryId: result.id,
      },
    });
  } catch {
    // Non-critical - do not fail the operation
  }

  return {
    success: true,
    journalEntryId: result.id,
    message: `Paiement de $${paymentAmount.toFixed(2)} appliqué à la facture ${invoice.invoiceNumber}`,
  };
}

// ---------------------------------------------------------------------------
// Suggest Unmatched Payments
// ---------------------------------------------------------------------------

/**
 * Find all unreconciled bank deposits and suggest possible invoice matches.
 */
export async function suggestUnmatchedPayments(): Promise<UnmatchedSuggestion[]> {
  const unmatchedTxs = await prisma.bankTransaction.findMany({
    where: {
      reconciliationStatus: 'PENDING',
      deletedAt: null,
      amount: { gt: 0 },
    },
    orderBy: { date: 'desc' },
    take: 50,
  });

  const openInvoices = await prisma.customerInvoice.findMany({
    where: {
      status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
      deletedAt: null,
    },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      balance: true,
      dueDate: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  const suggestions: UnmatchedSuggestion[] = [];

  for (const tx of unmatchedTxs) {
    const txAmount = Number(tx.amount);
    const suggested: UnmatchedSuggestion['suggestedInvoices'] = [];

    for (const inv of openInvoices) {
      const invBalance = Number(inv.balance);
      let confidence = 0;

      // Amount match
      const amountDiff = Math.abs(txAmount - invBalance);
      if (amountDiff === 0) {
        confidence += 50;
      } else if (amountDiff <= invBalance * 0.01) {
        confidence += 35;
      } else if (amountDiff <= invBalance * 0.05) {
        confidence += 15;
      } else {
        continue;
      }

      // Date proximity
      const daysDiff = Math.abs(
        Math.round((tx.date.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      );
      if (daysDiff <= 7) confidence += 25;
      else if (daysDiff <= 30) confidence += 15;
      else if (daysDiff <= 60) confidence += 5;

      // Reference match
      const searchStr = `${tx.reference ?? ''} ${tx.description}`.toUpperCase();
      if (searchStr.includes(inv.invoiceNumber.toUpperCase())) {
        confidence += 25;
      }

      if (confidence >= 20) {
        suggested.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          total: Number(inv.total),
          dueDate: inv.dueDate,
          confidence: Math.min(confidence, 100),
        });
      }
    }

    if (suggested.length > 0) {
      suggested.sort((a, b) => b.confidence - a.confidence);
      suggestions.push({
        bankTransactionId: tx.id,
        bankDate: tx.date,
        bankAmount: txAmount,
        bankDescription: tx.description,
        suggestedInvoices: suggested.slice(0, 5),
      });
    }
  }

  return suggestions;
}
