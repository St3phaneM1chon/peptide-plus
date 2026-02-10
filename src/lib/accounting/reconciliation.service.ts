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

const DEFAULT_CRITERIA: MatchCriteria = {
  dateToleranceDays: 3,
  amountTolerancePercent: 0.01, // 1% tolerance for rounding
  minConfidenceScore: 0.7,
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
        // Auto-match with high confidence
        bankTx.reconciliationStatus = 'MATCHED';
        bankTx.matchedJournalEntryId = bestMatch.journalEntryId;
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
    if (amountDiff > amountTolerance && amountDiff > 0.02) continue;

    // Calculate confidence score
    let confidence = 0;
    const reasons: string[] = [];

    // Exact amount match: +40%
    if (amountDiff < 0.01) {
      confidence += 0.4;
      reasons.push('Montant exact');
    } else if (amountDiff <= amountTolerance) {
      confidence += 0.3;
      reasons.push('Montant proche');
    }

    // Same date: +30%
    if (daysDiff === 0) {
      confidence += 0.3;
      reasons.push('Même date');
    } else if (daysDiff <= 1) {
      confidence += 0.2;
      reasons.push('Date proche (±1 jour)');
    } else {
      confidence += 0.1;
      reasons.push(`Date proche (±${Math.round(daysDiff)} jours)`);
    }

    // Reference match: +30%
    if (bankTx.reference && entry.reference) {
      if (bankTx.reference === entry.reference) {
        confidence += 0.3;
        reasons.push('Référence identique');
      } else if (
        bankTx.reference.toLowerCase().includes(entry.reference.toLowerCase()) ||
        entry.reference.toLowerCase().includes(bankTx.reference.toLowerCase())
      ) {
        confidence += 0.2;
        reasons.push('Référence similaire');
      }
    }

    // Description similarity: +10%
    const descSimilarity = calculateStringSimilarity(
      bankTx.description.toLowerCase(),
      entry.description.toLowerCase()
    );
    if (descSimilarity > 0.5) {
      confidence += 0.1;
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
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));

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
  if (amountDiff > bankAmount * 0.05) { // 5% tolerance for manual
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
 */
export function createEntryFromBankTransaction(
  bankTx: BankTransaction,
  debitAccount: string,
  creditAccount: string,
  description: string
): JournalEntry {
  const isCredit = bankTx.type === 'CREDIT';
  
  return {
    id: `entry-from-bank-${Date.now()}`,
    entryNumber: `JV-BANK-${Date.now()}`,
    date: new Date(bankTx.date),
    description,
    type: 'MANUAL',
    status: 'DRAFT',
    reference: bankTx.reference,
    lines: [
      {
        id: `line-${Date.now()}-1`,
        accountCode: isCredit ? debitAccount : creditAccount,
        accountName: isCredit ? debitAccount : creditAccount,
        description,
        debit: isCredit ? bankTx.amount : 0,
        credit: isCredit ? 0 : bankTx.amount,
      },
      {
        id: `line-${Date.now()}-2`,
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

    transactions.push({
      id: `import-${Date.now()}-${i}`,
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
  // Try various formats
  const formats = [
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
    /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      // Assume YYYY-MM-DD or adjust as needed
      return new Date(dateStr);
    }
  }

  return new Date(dateStr);
}
