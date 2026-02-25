/**
 * Smart Bank Reconciliation Engine
 * Auto-match transactions using fuzzy matching on vendor name, amount, date
 */

export interface TransactionMatch {
  bankTransactionId: string;
  journalEntryId: string;
  confidence: number; // 0-1
  matchType: 'EXACT' | 'AMOUNT_DATE' | 'FUZZY' | 'MANUAL';
  matchReasons: string[];
}

interface BankTxn {
  id: string;
  date: Date;
  amount: number;
  description: string;
  reference?: string;
}

interface JournalRef {
  id: string;
  date: Date;
  amount: number;
  description: string;
  reference?: string;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function dateDiffDays(a: Date, b: Date): number {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));
}

function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeText(a).split(' '));
  const wordsB = new Set(normalizeText(b).split(' '));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export function findMatches(
  bankTxns: BankTxn[],
  journalRefs: JournalRef[],
  toleranceDays: number = 3,
  toleranceAmount: number = 0.01
): TransactionMatch[] {
  const matches: TransactionMatch[] = [];
  const usedJournals = new Set<string>();

  for (const txn of bankTxns) {
    let bestMatch: TransactionMatch | null = null;
    let bestConfidence = 0;

    for (const ref of journalRefs) {
      if (usedJournals.has(ref.id)) continue;

      const amountMatch = Math.abs(Math.abs(txn.amount) - Math.abs(ref.amount)) <= toleranceAmount;
      const dateMatch = dateDiffDays(txn.date, ref.date) <= toleranceDays;
      const textSim = textSimilarity(txn.description, ref.description);
      const refMatch = txn.reference && ref.reference && txn.reference === ref.reference;

      let confidence = 0;
      const reasons: string[] = [];
      let matchType: TransactionMatch['matchType'] = 'FUZZY';

      // Exact match: same amount, date, and reference
      if (amountMatch && dateMatch && refMatch) {
        confidence = 0.99;
        matchType = 'EXACT';
        reasons.push('Montant identique', 'Date concordante', 'Référence identique');
      }
      // Amount + date match
      else if (amountMatch && dateMatch) {
        confidence = 0.8 + textSim * 0.15;
        matchType = 'AMOUNT_DATE';
        reasons.push('Montant identique', 'Date concordante');
        if (textSim > 0.3) reasons.push(`Description similaire (${Math.round(textSim * 100)}%)`);
      }
      // Amount match with close date
      else if (amountMatch && dateDiffDays(txn.date, ref.date) <= toleranceDays * 2) {
        confidence = 0.5 + textSim * 0.2;
        matchType = 'FUZZY';
        reasons.push('Montant identique', 'Date approximative');
      }

      if (confidence > bestConfidence && confidence >= 0.5) {
        bestConfidence = confidence;
        bestMatch = {
          bankTransactionId: txn.id,
          journalEntryId: ref.id,
          confidence,
          matchType,
          matchReasons: reasons,
        };
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
      usedJournals.add(bestMatch.journalEntryId);
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

export function categorizeMatches(matches: TransactionMatch[]): {
  autoMatch: TransactionMatch[];
  review: TransactionMatch[];
  unmatched: number;
} {
  const autoMatch = matches.filter(m => m.confidence >= 0.9);
  const review = matches.filter(m => m.confidence >= 0.5 && m.confidence < 0.9);
  return { autoMatch, review, unmatched: 0 };
}
