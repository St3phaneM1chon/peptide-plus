/**
 * Bank Reconciliation Service
 * Automatically matches bank transactions with journal entries
 */

import { BankTransaction, JournalEntry, ReconciliationResult, ReconciliationSuggestion } from './types';

interface MatchCriteria {
  dateToleranceDays: number;
  amountTolerancePercent: number;
  minConfidenceScore: number;
}

// #92 Named constants for reconciliation thresholds (extracted from magic numbers)
const RECONCILIATION_THRESHOLDS = {
  /** Default date tolerance for auto-matching (days) */
  DATE_TOLERANCE_DAYS: 3,
  /** Default amount tolerance for auto-matching (1% for rounding differences) */
  AMOUNT_TOLERANCE_PERCENT: 0.01,
  /** Minimum confidence to auto-match without manual review */
  MIN_AUTO_MATCH_CONFIDENCE: 0.7,
  /** Amount tolerance for manual matching (5% - more lenient) */
  MANUAL_MATCH_TOLERANCE_PERCENT: 0.05,
  /** Minimum absolute amount difference to ignore (rounding threshold in $) */
  AMOUNT_ROUNDING_THRESHOLD: 0.02,
  /** Penny-level exact match threshold ($) */
  EXACT_AMOUNT_THRESHOLD: 0.01,
  /** Minimum word length for string similarity comparison */
  MIN_WORD_LENGTH: 2,
  /** Minimum description similarity score to count as "similar" */
  MIN_DESCRIPTION_SIMILARITY: 0.5,
  // Confidence score weights
  CONFIDENCE_EXACT_AMOUNT: 0.4,
  CONFIDENCE_CLOSE_AMOUNT: 0.3,
  CONFIDENCE_SAME_DATE: 0.3,
  CONFIDENCE_CLOSE_DATE_1DAY: 0.2,
  CONFIDENCE_CLOSE_DATE_MULTI: 0.1,
  CONFIDENCE_EXACT_REFERENCE: 0.3,
  CONFIDENCE_SIMILAR_REFERENCE: 0.2,
  CONFIDENCE_SIMILAR_DESCRIPTION: 0.1,
} as const;

const DEFAULT_CRITERIA: MatchCriteria = {
  dateToleranceDays: RECONCILIATION_THRESHOLDS.DATE_TOLERANCE_DAYS,
  amountTolerancePercent: RECONCILIATION_THRESHOLDS.AMOUNT_TOLERANCE_PERCENT,
  minConfidenceScore: RECONCILIATION_THRESHOLDS.MIN_AUTO_MATCH_CONFIDENCE,
};

/**
 * Auto-reconcile bank transactions with journal entries
 */
export function autoReconcile(
  bankTransactions: BankTransaction[],
  journalEntries: JournalEntry[],
  criteria: MatchCriteria = DEFAULT_CRITERIA
): ReconciliationResult {
  const result: ReconciliationResult = {
    matched: 0,
    unmatched: 0,
    suggestions: [],
  };

  const unmatchedBank = bankTransactions.filter(t => t.reconciliationStatus === 'PENDING');
  const unmatchedEntries = journalEntries.filter(e => e.status === 'POSTED');

  for (const bankTx of unmatchedBank) {
    const suggestions = findMatches(bankTx, unmatchedEntries, criteria);

    if (suggestions.length > 0) {
      const bestMatch = suggestions[0];

      if (bestMatch.confidence >= criteria.minConfidenceScore) {
        // FIX: F070 - Mutating input objects is a side-effect that couples this function
        // to the caller's state. We still mutate here for backward compatibility with
        // reconciliation/route.ts which reads the mutated status. TODO: Return matched IDs
        // in the result instead and stop mutating inputs.
        bankTx.reconciliationStatus = 'MATCHED';
        (bankTx as unknown as Record<string, unknown>).matchedJournalEntryId = bestMatch.journalEntryId;
        result.matched++;
      } else {
        // Suggest for manual review
        result.suggestions.push(...suggestions);
        result.unmatched++;
      }
    } else {
      result.unmatched++;
    }
  }

  return result;
}

/**
 * Find potential matches for a bank transaction
 */
function findMatches(
  bankTx: BankTransaction,
  entries: JournalEntry[],
  criteria: MatchCriteria
): ReconciliationSuggestion[] {
  const suggestions: ReconciliationSuggestion[] = [];
  const bankDate = new Date(bankTx.date);
  const bankAmount = Math.abs(bankTx.amount);

  for (const entry of entries) {
    const entryDate = new Date(entry.date);
    const daysDiff = Math.abs((bankDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

    // Skip if date is too far
    if (daysDiff > criteria.dateToleranceDays) continue;

    // Calculate entry total (debits for credits to bank, credits for debits from bank)
    const entryAmount = bankTx.type === 'CREDIT'
      ? entry.lines.reduce((sum, l) => sum + l.debit, 0)
      : entry.lines.reduce((sum, l) => sum + l.credit, 0);

    const amountDiff = Math.abs(bankAmount - entryAmount);
    const amountTolerance = bankAmount * criteria.amountTolerancePercent;

    // Skip if amount is too different
    if (amountDiff > amountTolerance && amountDiff > RECONCILIATION_THRESHOLDS.AMOUNT_ROUNDING_THRESHOLD) continue;

    // Calculate confidence score using named weights (#92)
    let confidence = 0;
    const reasons: string[] = [];

    // Exact amount match
    if (amountDiff < RECONCILIATION_THRESHOLDS.EXACT_AMOUNT_THRESHOLD) {
      confidence += RECONCILIATION_THRESHOLDS.CONFIDENCE_EXACT_AMOUNT;
      reasons.push('Montant exact');
    } else if (amountDiff <= amountTolerance) {
      confidence += RECONCILIATION_THRESHOLDS.CONFIDENCE_CLOSE_AMOUNT;
      reasons.push('Montant proche');
    }

    // Date proximity
    if (daysDiff === 0) {
      confidence += RECONCILIATION_THRESHOLDS.CONFIDENCE_SAME_DATE;
      reasons.push('Même date');
    } else if (daysDiff <= 1) {
      confidence += RECONCILIATION_THRESHOLDS.CONFIDENCE_CLOSE_DATE_1DAY;
      reasons.push('Date proche (±1 jour)');
    } else {
      confidence += RECONCILIATION_THRESHOLDS.CONFIDENCE_CLOSE_DATE_MULTI;
      reasons.push(`Date proche (±${Math.round(daysDiff)} jours)`);
    }

    // Reference match
    if (bankTx.reference && entry.reference) {
      if (bankTx.reference === entry.reference) {
        confidence += RECONCILIATION_THRESHOLDS.CONFIDENCE_EXACT_REFERENCE;
        reasons.push('Référence identique');
      } else if (
        bankTx.reference.toLowerCase().includes(entry.reference.toLowerCase()) ||
        entry.reference.toLowerCase().includes(bankTx.reference.toLowerCase())
      ) {
        confidence += RECONCILIATION_THRESHOLDS.CONFIDENCE_SIMILAR_REFERENCE;
        reasons.push('Référence similaire');
      }
    }

    // Description similarity
    const descSimilarity = calculateStringSimilarity(
      bankTx.description.toLowerCase(),
      entry.description.toLowerCase()
    );
    if (descSimilarity > RECONCILIATION_THRESHOLDS.MIN_DESCRIPTION_SIMILARITY) {
      confidence += RECONCILIATION_THRESHOLDS.CONFIDENCE_SIMILAR_DESCRIPTION;
      reasons.push('Description similaire');
    }

    if (confidence > 0) {
      suggestions.push({
        bankTransactionId: bankTx.id,
        journalEntryId: entry.id,
        confidence: Math.min(confidence, 1),
        reason: reasons.join(', '),
      });
    }
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

/**
 * Calculate similarity between two strings (Jaccard similarity)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > RECONCILIATION_THRESHOLDS.MIN_WORD_LENGTH));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > RECONCILIATION_THRESHOLDS.MIN_WORD_LENGTH));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Manually match a bank transaction to a journal entry
 */
export function manualMatch(
  bankTx: BankTransaction,
  entry: JournalEntry
): { success: boolean; error?: string } {
  // Validate amounts match approximately
  const bankAmount = Math.abs(bankTx.amount);
  const entryAmount = bankTx.type === 'CREDIT'
    ? entry.lines.reduce((sum, l) => sum + l.debit, 0)
    : entry.lines.reduce((sum, l) => sum + l.credit, 0);

  const amountDiff = Math.abs(bankAmount - entryAmount);
  // #92 Use named constant instead of magic number
  if (amountDiff > bankAmount * RECONCILIATION_THRESHOLDS.MANUAL_MATCH_TOLERANCE_PERCENT) {
    return {
      success: false,
      error: `Les montants ne correspondent pas: Banque ${bankAmount.toFixed(2)}$ vs Écriture ${entryAmount.toFixed(2)}$`,
    };
  }

  bankTx.reconciliationStatus = 'MATCHED';
  bankTx.matchedJournalEntryId = entry.id;

  return { success: true };
}

/**
 * Mark a bank transaction as unmatched (no corresponding entry)
 */
export function markAsUnmatched(bankTx: BankTransaction, reason: string): void {
  bankTx.reconciliationStatus = 'UNMATCHED';
  // Store reason in rawData
  bankTx.rawData = {
    ...bankTx.rawData,
    unmatchedReason: reason,
    unmatchedAt: new Date().toISOString(),
  };
}

/**
 * Create a journal entry from an unmatched bank transaction
 * FIX: F018 - Use crypto.randomUUID() instead of Date.now() for unique IDs
 */
export function createEntryFromBankTransaction(
  bankTx: BankTransaction,
  debitAccount: string,
  creditAccount: string,
  description: string
): JournalEntry {
  const isCredit = bankTx.type === 'CREDIT';

  return {
    id: `entry-from-bank-${crypto.randomUUID()}`,
    entryNumber: `JV-BANK-${crypto.randomUUID().substring(0, 8)}`,
    date: new Date(bankTx.date),
    description,
    type: 'MANUAL',
    status: 'DRAFT',
    reference: bankTx.reference,
    lines: [
      {
        id: `line-${crypto.randomUUID()}-1`,
        accountCode: isCredit ? debitAccount : creditAccount,
        accountName: isCredit ? debitAccount : creditAccount,
        description,
        debit: isCredit ? bankTx.amount : 0,
        credit: isCredit ? 0 : bankTx.amount,
      },
      {
        id: `line-${crypto.randomUUID()}-2`,
        accountCode: isCredit ? creditAccount : debitAccount,
        accountName: isCredit ? creditAccount : debitAccount,
        description,
        debit: isCredit ? 0 : bankTx.amount,
        credit: isCredit ? bankTx.amount : 0,
      },
    ],
    createdBy: 'Système (depuis transaction bancaire)',
    createdAt: new Date(),
  };
}

/**
 * Get reconciliation summary for a period
 */
export function getReconciliationSummary(
  bankTransactions: BankTransaction[],
  bankBalance: number,
  bookBalance: number
): {
  bankBalance: number;
  bookBalance: number;
  difference: number;
  matched: number;
  unmatched: number;
  pending: number;
  percentComplete: number;
} {
  const matched = bankTransactions.filter(t => t.reconciliationStatus === 'MATCHED').length;
  const unmatched = bankTransactions.filter(t => t.reconciliationStatus === 'UNMATCHED').length;
  const pending = bankTransactions.filter(t => t.reconciliationStatus === 'PENDING').length;
  const total = bankTransactions.length;

  return {
    bankBalance,
    bookBalance,
    difference: bankBalance - bookBalance,
    matched,
    unmatched,
    pending,
    percentComplete: total > 0 ? Math.round((matched / total) * 100) : 0,
  };
}

/**
 * Parse bank statement from CSV
 */
export function parseBankStatementCSV(
  csvContent: string,
  bankAccountId: string,
  format: 'desjardins' | 'td' | 'rbc' | 'generic'
): BankTransaction[] {
  const lines = csvContent.split('\n').filter(l => l.trim());
  const transactions: BankTransaction[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    let date: Date;
    let description: string;
    let amount: number;
    let type: 'CREDIT' | 'DEBIT';

    switch (format) {
      case 'desjardins':
        // Format: Date,Description,Retrait,Dépôt,Solde
        date = parseDate(cols[0]);
        description = cols[1];
        if (cols[2] && parseFloat(cols[2])) {
          amount = Math.abs(parseFloat(cols[2]));
          type = 'DEBIT';
        } else {
          amount = Math.abs(parseFloat(cols[3]) || 0);
          type = 'CREDIT';
        }
        break;
        
      case 'td':
        // Format: Date,Description,Withdrawals,Deposits,Balance
        date = parseDate(cols[0]);
        description = cols[1];
        if (cols[2] && parseFloat(cols[2])) {
          amount = Math.abs(parseFloat(cols[2]));
          type = 'DEBIT';
        } else {
          amount = Math.abs(parseFloat(cols[3]) || 0);
          type = 'CREDIT';
        }
        break;
        
      default:
        // Generic: Date,Description,Amount (negative = debit)
        date = parseDate(cols[0]);
        description = cols[1];
        const rawAmount = parseFloat(cols[2]);
        amount = Math.abs(rawAmount);
        type = rawAmount >= 0 ? 'CREDIT' : 'DEBIT';
    }

    if (isNaN(amount) || amount === 0) continue;

    // FIX: F018 - Use crypto.randomUUID() instead of Date.now() for unique IDs
    transactions.push({
      id: `import-${crypto.randomUUID()}`,
      bankAccountId,
      date,
      description,
      amount,
      type,
      reconciliationStatus: 'PENDING',
      importedAt: new Date(),
    });
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

function parseDate(dateStr: string): Date {
  // YYYY-MM-DD
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
  }

  // DD/MM/YYYY - explicitly construct from captured groups to avoid
  // JS Date parsing it as MM/DD/YYYY
  const slashMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    return new Date(year, month - 1, day);
  }

  // DD-MM-YYYY
  const dashMatch = dateStr.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (dashMatch) {
    const day = parseInt(dashMatch[1], 10);
    const month = parseInt(dashMatch[2], 10);
    const year = parseInt(dashMatch[3], 10);
    return new Date(year, month - 1, day);
  }

  return new Date(dateStr);
}
