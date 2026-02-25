/**
 * Auto-Reconciliation Service - Phase 8: Automation
 * Enhanced automatic matching of bank transactions to journal entries.
 *
 * - autoReconcileByReference: match by reference/description text
 * - autoReconcileByAmount:    match by exact amount + date proximity (+/- 3 days)
 * - runAutoReconciliation:    batch-process all unreconciled bank transactions
 *
 * Confidence scoring:
 *   >= 0.95 -> auto-apply (update BankTransaction.reconciliationStatus to MATCHED)
 *    < 0.95 -> return as suggestion only
 */

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconciliationMatch {
  bankTransactionId: string;
  journalEntryId: string;
  confidence: number;
  reason: string;
  autoApplied: boolean;
}

export interface AutoReconciliationResult {
  processed: number;
  autoMatched: number;
  suggested: number;
  errors: string[];
  matches: ReconciliationMatch[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_APPLY_THRESHOLD = 0.95;
const DATE_PROXIMITY_DAYS = 3;

// Confidence weights
const WEIGHT_EXACT_REFERENCE = 0.50;
const WEIGHT_PARTIAL_REFERENCE = 0.30;
const WEIGHT_EXACT_AMOUNT = 0.35;
const WEIGHT_SAME_DATE = 0.15;
const WEIGHT_CLOSE_DATE = 0.10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return Math.abs(
    Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
  );
}

/**
 * Normalize a reference/description string for comparison.
 */
// F053 FIX: Proper Unicode normalization to handle French accented characters
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Match a single bank transaction to a journal entry by reference/description.
 */
export async function autoReconcileByReference(
  bankTxId: string
): Promise<ReconciliationMatch | null> {
  const bankTx = await prisma.bankTransaction.findUnique({
    where: { id: bankTxId },
  });
  if (!bankTx || bankTx.reconciliationStatus !== 'PENDING') return null;

  const searchRef = bankTx.reference || bankTx.description;
  if (!searchRef) return null;

  const normalizedRef = normalize(searchRef);
  if (normalizedRef.length === 0) return null;

  // Find journal entries with a similar reference or description
  const entries = await prisma.journalEntry.findMany({
    where: {
      status: 'POSTED',
      deletedAt: null,
      // Look within a reasonable time window
      date: {
        gte: new Date(bankTx.date.getTime() - DATE_PROXIMITY_DAYS * 86400000),
        lte: new Date(bankTx.date.getTime() + DATE_PROXIMITY_DAYS * 86400000),
      },
    },
    include: { lines: true },
    take: 100,
  });

  let bestMatch: ReconciliationMatch | null = null;
  const bankAmount = Math.abs(Number(bankTx.amount));

  for (const entry of entries) {
    let confidence = 0;
    const reasons: string[] = [];

    // Reference matching
    const entryRef = normalize(entry.reference || entry.description);
    if (entryRef.length > 0) {
      if (normalizedRef === entryRef) {
        confidence += WEIGHT_EXACT_REFERENCE;
        reasons.push('R\u00e9f\u00e9rence identique');
      } else if (normalizedRef.includes(entryRef) || entryRef.includes(normalizedRef)) {
        confidence += WEIGHT_PARTIAL_REFERENCE;
        reasons.push('R\u00e9f\u00e9rence partielle');
      }
    }

    // Amount matching
    // F046 FIX: Consider both debits and credits for accurate amount matching
    const entryAmount = entry.lines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0);
    const amountDiff = Math.abs(bankAmount - entryAmount);

    if (amountDiff < 0.01) {
      confidence += WEIGHT_EXACT_AMOUNT;
      reasons.push('Montant exact');
    }

    // Date proximity
    const dDays = daysBetween(bankTx.date, entry.date);
    if (dDays === 0) {
      confidence += WEIGHT_SAME_DATE;
      reasons.push('M\u00eame date');
    } else if (dDays <= DATE_PROXIMITY_DAYS) {
      confidence += WEIGHT_CLOSE_DATE;
      reasons.push(`Date proche (\u00b1${dDays}j)`);
    }

    confidence = Math.min(confidence, 1);

    if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = {
        bankTransactionId: bankTxId,
        journalEntryId: entry.id,
        confidence,
        reason: reasons.join(', '),
        autoApplied: false,
      };
    }
  }

  // Auto-apply if above threshold
  if (bestMatch && bestMatch.confidence >= AUTO_APPLY_THRESHOLD) {
    await prisma.bankTransaction.update({
      where: { id: bankTxId },
      data: {
        reconciliationStatus: 'MATCHED',
        matchedEntryId: bestMatch.journalEntryId,
        matchedAt: new Date(),
        matchedBy: 'Syst\u00e8me (auto-rapprochement r\u00e9f\u00e9rence)',
      },
    });
    bestMatch.autoApplied = true;
  }

  return bestMatch;
}

/**
 * Match a single bank transaction by exact amount + date proximity (+/- 3 days).
 */
export async function autoReconcileByAmount(
  bankTxId: string
): Promise<ReconciliationMatch | null> {
  const bankTx = await prisma.bankTransaction.findUnique({
    where: { id: bankTxId },
  });
  if (!bankTx || bankTx.reconciliationStatus !== 'PENDING') return null;

  const bankAmount = Math.abs(Number(bankTx.amount));
  const dateMin = new Date(bankTx.date.getTime() - DATE_PROXIMITY_DAYS * 86400000);
  const dateMax = new Date(bankTx.date.getTime() + DATE_PROXIMITY_DAYS * 86400000);

  // Find posted entries within date range
  const entries = await prisma.journalEntry.findMany({
    where: {
      status: 'POSTED',
      deletedAt: null,
      date: { gte: dateMin, lte: dateMax },
    },
    include: { lines: true },
    take: 200,
  });

  let bestMatch: ReconciliationMatch | null = null;

  for (const entry of entries) {
    // F046 FIX: Consider both debits and credits for accurate amount matching
    const entryAmount = entry.lines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0);
    const amountDiff = Math.abs(bankAmount - Math.abs(entryAmount));

    // Only consider exact amount matches (within penny)
    if (amountDiff >= 0.01) continue;

    let confidence = WEIGHT_EXACT_AMOUNT;
    const reasons: string[] = ['Montant exact'];

    // Date bonus
    const dDays = daysBetween(bankTx.date, entry.date);
    if (dDays === 0) {
      confidence += WEIGHT_SAME_DATE;
      reasons.push('M\u00eame date');
    } else {
      confidence += WEIGHT_CLOSE_DATE;
      reasons.push(`Date proche (\u00b1${dDays}j)`);
    }

    // Reference bonus
    if (bankTx.reference && entry.reference) {
      const nr = normalize(bankTx.reference);
      const ne = normalize(entry.reference);
      if (nr === ne) {
        confidence += WEIGHT_EXACT_REFERENCE;
        reasons.push('R\u00e9f\u00e9rence identique');
      } else if (nr.includes(ne) || ne.includes(nr)) {
        confidence += WEIGHT_PARTIAL_REFERENCE;
        reasons.push('R\u00e9f\u00e9rence partielle');
      }
    }

    confidence = Math.min(confidence, 1);

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = {
        bankTransactionId: bankTxId,
        journalEntryId: entry.id,
        confidence,
        reason: reasons.join(', '),
        autoApplied: false,
      };
    }
  }

  if (bestMatch && bestMatch.confidence >= AUTO_APPLY_THRESHOLD) {
    await prisma.bankTransaction.update({
      where: { id: bankTxId },
      data: {
        reconciliationStatus: 'MATCHED',
        matchedEntryId: bestMatch.journalEntryId,
        matchedAt: new Date(),
        matchedBy: 'Syst\u00e8me (auto-rapprochement montant)',
      },
    });
    bestMatch.autoApplied = true;
  }

  return bestMatch;
}

/**
 * Batch-process all unreconciled bank transactions.
 * First tries matching by reference, then by amount.
 *
 * FIX: F014 - Maintains a Set of already-matched journalEntryIds to prevent
 * the same journal entry from being matched to multiple bank transactions.
 *
 * F031 FIX: Bulk-load entries to eliminate N+1 queries
 * Previously each transaction triggered 2-4 individual DB queries via
 * autoReconcileByReference() and autoReconcileByAmount(). For 100 pending
 * transactions, this produced ~200-400 DB round-trips.
 * Now we pre-load all pending bank transactions (with full data) and all
 * POSTED journal entries (with lines) for the relevant date range in bulk,
 * then match entirely in-memory. This reduces DB calls from O(n) to O(1).
 */
export async function runAutoReconciliation(): Promise<AutoReconciliationResult> {
  const result: AutoReconciliationResult = {
    processed: 0,
    autoMatched: 0,
    suggested: 0,
    errors: [],
    matches: [],
  };

  // FIX: F014 - Track journal entries already matched in this batch run
  // to prevent the same entry from being assigned to multiple bank transactions
  const matchedJournalEntryIds = new Set<string>();

  // F031 FIX: Bulk-load all pending bank transactions with full data
  const pendingTxs = await prisma.bankTransaction.findMany({
    where: {
      reconciliationStatus: 'PENDING',
      deletedAt: null,
    },
    orderBy: { date: 'asc' },
  });

  if (pendingTxs.length === 0) return result;

  // F031 FIX: Compute the date range covering all pending transactions +/- proximity window
  const txDates = pendingTxs.map((t) => t.date.getTime());
  const minTxDate = Math.min(...txDates);
  const maxTxDate = Math.max(...txDates);
  const dateRangeMin = new Date(minTxDate - DATE_PROXIMITY_DAYS * 86400000);
  const dateRangeMax = new Date(maxTxDate + DATE_PROXIMITY_DAYS * 86400000);

  // F031 FIX: Single bulk query to load ALL candidate journal entries with lines
  const allEntries = await prisma.journalEntry.findMany({
    where: {
      status: 'POSTED',
      deletedAt: null,
      date: {
        gte: dateRangeMin,
        lte: dateRangeMax,
      },
    },
    include: { lines: true },
  });

  // F031 FIX: Pre-compute normalized references and amounts for all entries
  const entryData = allEntries.map((entry) => ({
    entry,
    normalizedRef: normalize(entry.reference || entry.description),
    amount: entry.lines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0),
  }));

  for (const bankTx of pendingTxs) {
    result.processed++;

    try {
      let bestMatch: ReconciliationMatch | null = null;
      const bankAmount = Math.abs(Number(bankTx.amount));
      const searchRef = bankTx.reference || bankTx.description;
      const normalizedBankRef = searchRef ? normalize(searchRef) : '';

      // F031 FIX: In-memory matching against pre-loaded entries
      for (const { entry, normalizedRef: entryRef, amount: entryAmount } of entryData) {
        // FIX: F014 - Skip entries already matched in this batch
        if (matchedJournalEntryIds.has(entry.id)) continue;

        // Check date proximity
        const dDays = daysBetween(bankTx.date, entry.date);
        if (dDays > DATE_PROXIMITY_DAYS) continue;

        let confidence = 0;
        const reasons: string[] = [];

        // Reference matching
        if (normalizedBankRef.length > 0 && entryRef.length > 0) {
          if (normalizedBankRef === entryRef) {
            confidence += WEIGHT_EXACT_REFERENCE;
            reasons.push('R\u00e9f\u00e9rence identique');
          } else if (normalizedBankRef.includes(entryRef) || entryRef.includes(normalizedBankRef)) {
            confidence += WEIGHT_PARTIAL_REFERENCE;
            reasons.push('R\u00e9f\u00e9rence partielle');
          }
        }

        // Amount matching
        const amountDiff = Math.abs(bankAmount - Math.abs(entryAmount));
        if (amountDiff < 0.01) {
          confidence += WEIGHT_EXACT_AMOUNT;
          reasons.push('Montant exact');
        }

        // Date proximity
        if (dDays === 0) {
          confidence += WEIGHT_SAME_DATE;
          reasons.push('M\u00eame date');
        } else if (dDays <= DATE_PROXIMITY_DAYS) {
          confidence += WEIGHT_CLOSE_DATE;
          reasons.push(`Date proche (\u00b1${dDays}j)`);
        }

        confidence = Math.min(confidence, 1);

        if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = {
            bankTransactionId: bankTx.id,
            journalEntryId: entry.id,
            confidence,
            reason: reasons.join(', '),
            autoApplied: false,
          };
        }
      }

      // Auto-apply if above threshold
      if (bestMatch && bestMatch.confidence >= AUTO_APPLY_THRESHOLD) {
        await prisma.bankTransaction.update({
          where: { id: bankTx.id },
          data: {
            reconciliationStatus: 'MATCHED',
            matchedEntryId: bestMatch.journalEntryId,
            matchedAt: new Date(),
            matchedBy: 'Syst\u00e8me (auto-rapprochement batch)',
          },
        });
        bestMatch.autoApplied = true;
      }

      if (bestMatch) {
        // FIX: F014 - Record this journal entry as matched so it won't be reused
        matchedJournalEntryIds.add(bestMatch.journalEntryId);
        result.matches.push(bestMatch);
        if (bestMatch.autoApplied) {
          result.autoMatched++;
        } else {
          result.suggested++;
        }
      }
    } catch (error) {
      console.error('[AutoReconciliation] Reconciliation failed for transaction:', bankTx.id, error);
      result.errors.push(
        `Erreur pour tx ${bankTx.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// A089: Bank Reconciliation Health Indicator
// Provides a quick dashboard-ready summary of reconciliation status.
// ---------------------------------------------------------------------------

export interface ReconciliationHealth {
  /** Percentage of bank transactions that are reconciled (0-100) */
  reconciledPct: number;
  /** Total number of bank transactions in scope */
  totalTransactions: number;
  /** Number of reconciled (MATCHED) transactions */
  matchedTransactions: number;
  /** Number of unreconciled (PENDING) transactions */
  pendingTransactions: number;
  /** Total unreconciled amount (absolute sum) */
  unreconciledAmount: number;
  /** Days since last successful reconciliation (null if never) */
  daysSinceLastReconciliation: number | null;
  /** Overall health status */
  status: 'GOOD' | 'ATTENTION' | 'CRITICAL';
  /** Human-readable summary */
  summary: string;
}

/**
 * A089: Get a health indicator for bank reconciliation status.
 * Useful for dashboard widgets showing reconciliation progress at a glance.
 */
export async function getReconciliationHealth(): Promise<ReconciliationHealth> {
  // Count transactions by status
  const [matchedCount, pendingCount, lastMatchedTx] = await Promise.all([
    prisma.bankTransaction.count({
      where: { reconciliationStatus: 'MATCHED', deletedAt: null },
    }),
    prisma.bankTransaction.count({
      where: { reconciliationStatus: 'PENDING', deletedAt: null },
    }),
    prisma.bankTransaction.findFirst({
      where: { reconciliationStatus: 'MATCHED', matchedAt: { not: null }, deletedAt: null },
      orderBy: { matchedAt: 'desc' },
      select: { matchedAt: true },
    }),
  ]);

  const totalTransactions = matchedCount + pendingCount;
  const reconciledPct = totalTransactions > 0
    ? Math.round((matchedCount / totalTransactions) * 10000) / 100
    : 100;

  // Sum unreconciled amounts
  const unreconciledAgg = await prisma.bankTransaction.aggregate({
    where: { reconciliationStatus: 'PENDING', deletedAt: null },
    _sum: { amount: true },
  });
  const unreconciledAmount = Math.abs(Number(unreconciledAgg._sum.amount ?? 0));

  // Days since last reconciliation
  let daysSinceLastReconciliation: number | null = null;
  if (lastMatchedTx?.matchedAt) {
    const diffMs = Date.now() - lastMatchedTx.matchedAt.getTime();
    daysSinceLastReconciliation = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // Determine health status
  let status: ReconciliationHealth['status'] = 'GOOD';
  if (reconciledPct < 50 || (daysSinceLastReconciliation !== null && daysSinceLastReconciliation > 30)) {
    status = 'CRITICAL';
  } else if (reconciledPct < 80 || (daysSinceLastReconciliation !== null && daysSinceLastReconciliation > 14)) {
    status = 'ATTENTION';
  }

  // Build summary
  const parts: string[] = [];
  parts.push(`${reconciledPct}% rapproché (${matchedCount}/${totalTransactions})`);
  if (pendingCount > 0) {
    parts.push(`${pendingCount} transactions en attente (${unreconciledAmount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })})`);
  }
  if (daysSinceLastReconciliation !== null) {
    parts.push(`dernier rapprochement: il y a ${daysSinceLastReconciliation} jour(s)`);
  } else {
    parts.push('aucun rapprochement effectué');
  }

  return {
    reconciledPct,
    totalTransactions,
    matchedTransactions: matchedCount,
    pendingTransactions: pendingCount,
    unreconciledAmount,
    daysSinceLastReconciliation,
    status,
    summary: parts.join(' | '),
  };
}
