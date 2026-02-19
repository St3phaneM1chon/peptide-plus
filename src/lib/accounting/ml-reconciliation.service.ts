/**
 * ML-based Intelligent Reconciliation Service
 * Uses pattern learning and scoring algorithms for smart matching
 */

import { BankTransaction, JournalEntry, ReconciliationSuggestion } from './types';

interface MatchingRule {
  id: string;
  name: string;
  pattern: {
    bankDescriptionRegex?: string;
    amountRange?: { min: number; max: number };
    dayOfMonth?: number[];
    accountCodes?: string[];
  };
  action: {
    accountCode: string;
    description: string;
    autoMatch: boolean;
  };
  stats: {
    timesUsed: number;
    successRate: number;
    lastUsed?: Date;
  };
}

/* For future ML training use
interface MatchingHistory {
  bankTransactionId: string;
  journalEntryId: string;
  matchedAt: Date;
  matchedBy: 'AUTO' | 'MANUAL' | 'RULE';
  confidence: number;
  features: MatchFeatures;
}
*/

interface MatchFeatures {
  amountMatch: number; // 0-1
  dateMatch: number; // 0-1
  descriptionSimilarity: number; // 0-1
  referenceMatch: number; // 0-1
  patternMatch: number; // 0-1
  historicalMatch: number; // 0-1
}

// Learned patterns storage (in production, store in database)
const learnedPatterns: Map<string, MatchingRule> = new Map();

/**
 * Calculate feature vector for a potential match
 */
function calculateFeatures(
  bankTx: BankTransaction,
  entry: JournalEntry
): MatchFeatures {
  const features: MatchFeatures = {
    amountMatch: 0,
    dateMatch: 0,
    descriptionSimilarity: 0,
    referenceMatch: 0,
    patternMatch: 0,
    historicalMatch: 0,
  };

  // Amount matching (fuzzy)
  const bankAmount = Math.abs(bankTx.amount);
  const entryAmount = bankTx.type === 'CREDIT'
    ? entry.lines.reduce((sum, l) => sum + Number(l.debit), 0)
    : entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  const amountDiff = Math.abs(bankAmount - entryAmount);
  const amountTolerance = bankAmount * 0.02; // 2% tolerance

  if (amountDiff < 0.01) {
    features.amountMatch = 1.0;
  } else if (amountDiff <= amountTolerance) {
    features.amountMatch = 1.0 - (amountDiff / amountTolerance) * 0.3;
  } else if (amountDiff <= bankAmount * 0.1) {
    features.amountMatch = 0.5;
  }

  // Date matching
  const bankDate = new Date(bankTx.date);
  const entryDate = new Date(entry.date);
  const daysDiff = Math.abs((bankDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    features.dateMatch = 1.0;
  } else if (daysDiff <= 1) {
    features.dateMatch = 0.9;
  } else if (daysDiff <= 3) {
    features.dateMatch = 0.7;
  } else if (daysDiff <= 7) {
    features.dateMatch = 0.4;
  }

  // Description similarity (TF-IDF style)
  features.descriptionSimilarity = calculateTextSimilarity(
    bankTx.description.toLowerCase(),
    entry.description.toLowerCase()
  );

  // Reference matching
  if (bankTx.reference && entry.reference) {
    if (bankTx.reference === entry.reference) {
      features.referenceMatch = 1.0;
    } else if (
      bankTx.reference.includes(entry.reference) ||
      entry.reference.includes(bankTx.reference)
    ) {
      features.referenceMatch = 0.8;
    } else {
      // Partial match
      const commonChars = countCommonSubstring(bankTx.reference, entry.reference);
      features.referenceMatch = commonChars / Math.max(bankTx.reference.length, entry.reference.length);
    }
  }

  // Pattern matching (check against learned patterns)
  const patternScore = checkLearnedPatterns(bankTx, entry);
  features.patternMatch = patternScore;

  return features;
}

/**
 * Calculate text similarity using word overlap (Jaccard)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  // Weighted by important keywords
  const importantKeywords = ['stripe', 'paypal', 'virement', 'transfer', 'paiement', 'remboursement'];
  let bonus = 0;
  for (const word of intersection) {
    if (importantKeywords.some(kw => word.includes(kw))) {
      bonus += 0.1;
    }
  }

  return Math.min(1, (intersection.size / union.size) + bonus);
}

/**
 * Count longest common substring
 */
function countCommonSubstring(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  let maxLength = 0;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        maxLength = Math.max(maxLength, dp[i][j]);
      }
    }
  }

  return maxLength;
}

/**
 * Check against learned patterns
 */
function checkLearnedPatterns(bankTx: BankTransaction, entry: JournalEntry): number {
  let maxScore = 0;

  for (const [, rule] of learnedPatterns) {
    let score = 0;
    let matchCount = 0;

    // Check description regex (wrapped in try/catch to handle malformed patterns)
    if (rule.pattern.bankDescriptionRegex) {
      try {
        const regex = new RegExp(rule.pattern.bankDescriptionRegex, 'i');
        if (regex.test(bankTx.description)) {
          score += 0.4;
          matchCount++;
        }
      } catch {
        // Skip invalid regex patterns gracefully
      }
    }

    // Check amount range
    if (rule.pattern.amountRange) {
      if (bankTx.amount >= rule.pattern.amountRange.min &&
          bankTx.amount <= rule.pattern.amountRange.max) {
        score += 0.3;
        matchCount++;
      }
    }

    // Check account codes
    if (rule.pattern.accountCodes) {
      const entryCodes = entry.lines.map(l => l.accountCode);
      if (entryCodes.some(code => rule.pattern.accountCodes?.includes(code))) {
        score += 0.3;
        matchCount++;
      }
    }

    // Weight by success rate
    if (matchCount > 0) {
      score = score * rule.stats.successRate;
      maxScore = Math.max(maxScore, score);
    }
  }

  return maxScore;
}

/**
 * Calculate overall confidence score from features
 */
function calculateConfidenceScore(features: MatchFeatures): number {
  // Weighted combination
  const weights = {
    amountMatch: 0.35,
    dateMatch: 0.15,
    descriptionSimilarity: 0.15,
    referenceMatch: 0.20,
    patternMatch: 0.10,
    historicalMatch: 0.05,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += (features[key as keyof MatchFeatures] || 0) * weight;
  }

  return Math.round(score * 100) / 100;
}

// #72 Audit: Configurable confidence thresholds (not hardcoded)
export const DEFAULT_MATCH_THRESHOLDS = {
  autoMatch: 0.85,
  suggestion: 0.5,
  maxSuggestionsPerTx: 3,
} as const;

/**
 * ML-enhanced reconciliation
 * #72 Audit: All thresholds are configurable via options (defaults exported above)
 */
export function intelligentReconcile(
  bankTransactions: BankTransaction[],
  journalEntries: JournalEntry[],
  options: {
    autoMatchThreshold?: number;
    suggestionThreshold?: number;
    maxSuggestionsPerTransaction?: number;
  } = {}
): {
  autoMatched: { bankId: string; entryId: string; confidence: number }[];
  suggestions: ReconciliationSuggestion[];
  unmatched: string[];
  stats: {
    totalProcessed: number;
    autoMatchedCount: number;
    suggestedCount: number;
    unmatchedCount: number;
    averageConfidence: number;
  };
} {
  const {
    autoMatchThreshold = DEFAULT_MATCH_THRESHOLDS.autoMatch,
    suggestionThreshold = DEFAULT_MATCH_THRESHOLDS.suggestion,
    maxSuggestionsPerTransaction = DEFAULT_MATCH_THRESHOLDS.maxSuggestionsPerTx,
  } = options;

  const result = {
    autoMatched: [] as { bankId: string; entryId: string; confidence: number }[],
    suggestions: [] as ReconciliationSuggestion[],
    unmatched: [] as string[],
    stats: {
      totalProcessed: 0,
      autoMatchedCount: 0,
      suggestedCount: 0,
      unmatchedCount: 0,
      averageConfidence: 0,
    },
  };

  const unmatchedEntries = new Set(journalEntries.map(e => e.id));
  let totalConfidence = 0;

  for (const bankTx of bankTransactions) {
    if (bankTx.reconciliationStatus !== 'PENDING') continue;
    
    result.stats.totalProcessed++;
    const candidates: { entry: JournalEntry; features: MatchFeatures; confidence: number }[] = [];

    // Score all potential matches
    for (const entry of journalEntries) {
      if (!unmatchedEntries.has(entry.id)) continue;

      const features = calculateFeatures(bankTx, entry);
      const confidence = calculateConfidenceScore(features);

      if (confidence >= suggestionThreshold) {
        candidates.push({ entry, features, confidence });
      }
    }

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);

    if (candidates.length > 0) {
      const bestMatch = candidates[0];
      totalConfidence += bestMatch.confidence;

      if (bestMatch.confidence >= autoMatchThreshold) {
        // Auto-match
        result.autoMatched.push({
          bankId: bankTx.id,
          entryId: bestMatch.entry.id,
          confidence: bestMatch.confidence,
        });
        unmatchedEntries.delete(bestMatch.entry.id);
        result.stats.autoMatchedCount++;
      } else {
        // Add suggestions
        const suggestions = candidates.slice(0, maxSuggestionsPerTransaction);
        for (const suggestion of suggestions) {
          result.suggestions.push({
            bankTransactionId: bankTx.id,
            journalEntryId: suggestion.entry.id,
            confidence: suggestion.confidence,
            reason: generateMatchReason(suggestion.features),
          });
        }
        result.stats.suggestedCount++;
      }
    } else {
      result.unmatched.push(bankTx.id);
      result.stats.unmatchedCount++;
    }
  }

  result.stats.averageConfidence = result.stats.totalProcessed > 0
    ? Math.round((totalConfidence / result.stats.totalProcessed) * 100) / 100
    : 0;

  return result;
}

/**
 * Generate human-readable match reason
 */
function generateMatchReason(features: MatchFeatures): string {
  const reasons: string[] = [];

  if (features.amountMatch >= 0.95) {
    reasons.push('Montant exact');
  } else if (features.amountMatch >= 0.7) {
    reasons.push('Montant proche');
  }

  if (features.dateMatch >= 0.9) {
    reasons.push('Même date');
  } else if (features.dateMatch >= 0.7) {
    reasons.push('Date proche');
  }

  if (features.referenceMatch >= 0.8) {
    reasons.push('Référence similaire');
  }

  if (features.descriptionSimilarity >= 0.5) {
    reasons.push('Description similaire');
  }

  if (features.patternMatch >= 0.5) {
    reasons.push('Pattern connu');
  }

  return reasons.length > 0 ? reasons.join(', ') : 'Correspondance possible';
}

/**
 * Learn from manual match to improve future matching
 */
export function learnFromMatch(
  bankTx: BankTransaction,
  entry: JournalEntry,
  wasCorrect: boolean
): void {
  // Extract pattern features
  const descriptionWords = bankTx.description.split(/\s+/).filter(w => w.length > 3);
  const significantWords = descriptionWords.slice(0, 3)
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const accountCodes = entry.lines.map(l => l.accountCode);

  const ruleId = `rule-${significantWords.toLowerCase().replace(/[^a-z]/g, '')}`;

  if (learnedPatterns.has(ruleId)) {
    const existingRule = learnedPatterns.get(ruleId)!;
    existingRule.stats.timesUsed++;
    existingRule.stats.lastUsed = new Date();
    
    // Update success rate with exponential moving average
    const alpha = 0.2;
    existingRule.stats.successRate = wasCorrect
      ? existingRule.stats.successRate + alpha * (1 - existingRule.stats.successRate)
      : existingRule.stats.successRate + alpha * (0 - existingRule.stats.successRate);
  } else if (wasCorrect) {
    // Create new rule
    const newRule: MatchingRule = {
      id: ruleId,
      name: `Pattern: ${significantWords}`,
      pattern: {
        bankDescriptionRegex: significantWords,
        amountRange: {
          min: bankTx.amount * 0.9,
          max: bankTx.amount * 1.1,
        },
        accountCodes,
      },
      action: {
        accountCode: accountCodes[0],
        description: entry.description,
        autoMatch: false,
      },
      stats: {
        timesUsed: 1,
        successRate: 1.0,
        lastUsed: new Date(),
      },
    };
    learnedPatterns.set(ruleId, newRule);
  }
}

/**
 * Get current learned rules for display/management
 */
export function getLearnedRules(): MatchingRule[] {
  return Array.from(learnedPatterns.values())
    .sort((a, b) => b.stats.successRate - a.stats.successRate);
}

/**
 * Delete a learned rule
 */
export function deleteLearnedRule(ruleId: string): boolean {
  return learnedPatterns.delete(ruleId);
}

/**
 * Detect anomalies in transactions
 */
export function detectAnomalies(
  transactions: BankTransaction[],
  historicalAverage: Map<string, number>
): { transactionId: string; type: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; message: string }[] {
  const anomalies: { transactionId: string; type: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; message: string }[] = [];

  for (const tx of transactions) {
    const category = tx.category || 'default';
    const avgAmount = historicalAverage.get(category) || tx.amount;

    // Check for unusually high amount
    if (tx.amount > avgAmount * 2) {
      anomalies.push({
        transactionId: tx.id,
        type: 'HIGH_AMOUNT',
        severity: tx.amount > avgAmount * 5 ? 'HIGH' : 'MEDIUM',
        message: `Montant inhabituel: ${tx.amount.toFixed(2)}$ (moyenne: ${avgAmount.toFixed(2)}$)`,
      });
    }

    // Check for duplicate (same amount, same day, similar description)
    const duplicates = transactions.filter(other =>
      other.id !== tx.id &&
      Math.abs(other.amount - tx.amount) < 0.01 &&
      Math.abs(new Date(other.date).getTime() - new Date(tx.date).getTime()) < 86400000 &&
      calculateTextSimilarity(other.description, tx.description) > 0.7
    );

    if (duplicates.length > 0) {
      anomalies.push({
        transactionId: tx.id,
        type: 'POTENTIAL_DUPLICATE',
        severity: 'MEDIUM',
        message: `Doublon potentiel avec ${duplicates.length} autre(s) transaction(s)`,
      });
    }
  }

  return anomalies;
}
