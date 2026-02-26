/**
 * ML-based Intelligent Reconciliation Service
 * Uses pattern learning and scoring algorithms for smart matching
 *
 * FIX (F029): Patterns are now persisted to the BankRule table (createdBy='ml-reconciliation').
 * On each request, patterns are loaded from DB -- no global state dependency.
 * Works correctly in serverless environments (Vercel, Azure Functions).
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
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

/** Tag used to identify ML-generated BankRule records */
const ML_RULE_CREATOR = 'ml-reconciliation';

/**
 * Extra pattern data serialised into BankRule.categoryTag as JSON.
 * The BankRule schema does not have a dedicated JSON field, so we re-use
 * categoryTag which is a nullable String -- prefixed with 'ml:' to avoid
 * collisions with real category tags.
 */
interface MLPatternMetadata {
  accountCodes?: string[];
  dayOfMonth?: number[];
  actionAccountCode: string;
  actionDescription: string;
  autoMatch: boolean;
  successRate: number;
}

function serializeMetadata(meta: MLPatternMetadata): string {
  return `ml:${JSON.stringify(meta)}`;
}

function deserializeMetadata(raw: string | null): MLPatternMetadata | null {
  if (!raw || !raw.startsWith('ml:')) return null;
  try {
    return JSON.parse(raw.slice(3)) as MLPatternMetadata;
  } catch {
    return null;
  }
}

/**
 * Load learned patterns from the BankRule table.
 * Called on every reconciliation run so there is no stale in-memory cache.
 */
export async function loadLearnedPatterns(): Promise<Map<string, MatchingRule>> {
  const patterns = new Map<string, MatchingRule>();
  try {
    const rules = await prisma.bankRule.findMany({
      where: { createdBy: ML_RULE_CREATOR, isActive: true },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      const meta = deserializeMetadata(rule.categoryTag);
      if (!meta) continue;

      const matchingRule: MatchingRule = {
        id: rule.id,
        name: rule.name,
        pattern: {
          bankDescriptionRegex: rule.descriptionContains ?? undefined,
          amountRange: rule.amountMin != null && rule.amountMax != null
            ? { min: Number(rule.amountMin), max: Number(rule.amountMax) }
            : undefined,
          dayOfMonth: meta.dayOfMonth,
          accountCodes: meta.accountCodes,
        },
        action: {
          accountCode: meta.actionAccountCode,
          description: meta.actionDescription,
          autoMatch: meta.autoMatch,
        },
        stats: {
          timesUsed: rule.timesApplied,
          successRate: meta.successRate,
          lastUsed: rule.lastAppliedAt ?? undefined,
        },
      };
      patterns.set(rule.id, matchingRule);
    }
  } catch (error) {
    logger.error('[MLReconciliation] Failed to load patterns from DB', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return patterns;
}

/**
 * @deprecated Use loadLearnedPatterns() instead. Kept for backward compatibility.
 * In-memory map that is populated by loadLearnedPatterns().
 */
export const learnedPatterns: Map<string, MatchingRule> = new Map();

/**
 * Calculate feature vector for a potential match
 */
function calculateFeatures(
  bankTx: BankTransaction,
  entry: JournalEntry,
  patterns?: Map<string, MatchingRule>,
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
  const patternScore = checkLearnedPatterns(bankTx, entry, patterns);
  features.patternMatch = patternScore;

  return features;
}

/**
 * Calculate text similarity using word overlap (Jaccard)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  // FIX: F095 - Lowered min word length from 3 to 2 to keep bank codes like "TD", "RBC", "FX"
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length >= 2));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length >= 2));

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
// F080 FIX: Limit string length and use rolling array for O(min(m,n)) space
function countCommonSubstring(str1: string, str2: string): number {
  const maxLen = 100;
  const a = str1.substring(0, maxLen);
  const b = str2.substring(0, maxLen);
  const m = a.length;
  const n = b.length;
  const prev: number[] = Array(n + 1).fill(0);
  const curr: number[] = Array(n + 1).fill(0);
  let maxLength = 0;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        maxLength = Math.max(maxLength, curr[j]);
      } else {
        curr[j] = 0;
      }
    }
    for (let j = 0; j <= n; j++) { prev[j] = curr[j]; curr[j] = 0; }
  }

  return maxLength;
}

/**
 * Check against learned patterns
 */
function checkLearnedPatterns(
  bankTx: BankTransaction,
  entry: JournalEntry,
  patterns?: Map<string, MatchingRule>,
): number {
  const patternsMap = patterns ?? learnedPatterns;
  let maxScore = 0;

  for (const [, rule] of patternsMap) {
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
      } catch (error) {
        console.error('[MLReconciliation] Invalid regex pattern in rule, skipping:', rule.pattern.bankDescriptionRegex, error);
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
 *
 * FIX (F029): Now loads patterns from DB at the start of each reconciliation run.
 * The function is async to support the DB fetch. Serverless-safe.
 */
export async function intelligentReconcile(
  bankTransactions: BankTransaction[],
  journalEntries: JournalEntry[],
  options: {
    autoMatchThreshold?: number;
    suggestionThreshold?: number;
    maxSuggestionsPerTransaction?: number;
  } = {}
): Promise<{
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
}> {
  const {
    autoMatchThreshold = DEFAULT_MATCH_THRESHOLDS.autoMatch,
    suggestionThreshold = DEFAULT_MATCH_THRESHOLDS.suggestion,
    maxSuggestionsPerTransaction = DEFAULT_MATCH_THRESHOLDS.maxSuggestionsPerTx,
  } = options;

  // FIX (F029): Load patterns from DB at the start of each run
  const patterns = await loadLearnedPatterns();

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

      const features = calculateFeatures(bankTx, entry, patterns);
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
 * Learn from manual match to improve future matching.
 *
 * FIX (F029): Persists patterns to the BankRule table instead of in-memory Map.
 * Uses createdBy='ml-reconciliation' to distinguish ML-generated rules from
 * manually-created bank rules. Pattern metadata stored in categoryTag as JSON.
 */
export async function learnFromMatch(
  bankTx: BankTransaction,
  entry: JournalEntry,
  wasCorrect: boolean
): Promise<void> {
  // Extract pattern features
  const descriptionWords = bankTx.description.split(/\s+/).filter(w => w.length > 3);
  const significantWords = descriptionWords.slice(0, 3)
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const accountCodes = entry.lines.map(l => l.accountCode);

  const ruleName = `ML Pattern: ${significantWords || bankTx.description.substring(0, 40)}`;

  try {
    // Look for an existing ML-generated rule with the same description pattern
    const existingRule = await prisma.bankRule.findFirst({
      where: {
        createdBy: ML_RULE_CREATOR,
        descriptionContains: significantWords || null,
      },
    });

    if (existingRule) {
      // Update existing rule
      const meta = deserializeMetadata(existingRule.categoryTag) ?? {
        accountCodes: [],
        actionAccountCode: accountCodes[0] || '',
        actionDescription: entry.description,
        autoMatch: false,
        successRate: 1.0,
      };

      // Update success rate with exponential moving average
      const alpha = 0.2;
      meta.successRate = wasCorrect
        ? meta.successRate + alpha * (1 - meta.successRate)
        : meta.successRate + alpha * (0 - meta.successRate);

      await prisma.bankRule.update({
        where: { id: existingRule.id },
        data: {
          timesApplied: existingRule.timesApplied + 1,
          lastAppliedAt: new Date(),
          categoryTag: serializeMetadata(meta),
          // Deactivate rule if success rate drops too low
          isActive: meta.successRate > 0.15,
        },
      });

      logger.info('[MLReconciliation] Updated existing pattern', {
        ruleId: existingRule.id,
        wasCorrect,
        newSuccessRate: meta.successRate,
      });
    } else if (wasCorrect) {
      // Create new rule persisted to BankRule table
      const meta: MLPatternMetadata = {
        accountCodes,
        actionAccountCode: accountCodes[0] || '',
        actionDescription: entry.description,
        autoMatch: false,
        successRate: 1.0,
      };

      const newRule = await prisma.bankRule.create({
        data: {
          name: ruleName,
          priority: 0,
          isActive: true,
          descriptionContains: significantWords || null,
          amountMin: Math.round(bankTx.amount * 0.9 * 100) / 100,
          amountMax: Math.round(bankTx.amount * 1.1 * 100) / 100,
          categoryTag: serializeMetadata(meta),
          createdBy: ML_RULE_CREATOR,
          timesApplied: 1,
          lastAppliedAt: new Date(),
        },
      });

      logger.info('[MLReconciliation] Created new pattern', {
        ruleId: newRule.id,
        pattern: significantWords,
        amountRange: `${bankTx.amount * 0.9} - ${bankTx.amount * 1.1}`,
      });
    }
  } catch (error) {
    // Log but don't throw -- pattern learning is best-effort
    logger.error('[MLReconciliation] Failed to persist pattern', {
      error: error instanceof Error ? error.message : String(error),
      bankTxDescription: bankTx.description.substring(0, 50),
    });
  }
}

/**
 * Get current learned rules for display/management.
 * FIX (F029): Reads from BankRule table.
 */
export async function getLearnedRules(): Promise<MatchingRule[]> {
  const patterns = await loadLearnedPatterns();
  return Array.from(patterns.values())
    .sort((a, b) => b.stats.successRate - a.stats.successRate);
}

/**
 * Delete a learned rule.
 * FIX (F029): Deletes from BankRule table.
 */
export async function deleteLearnedRule(ruleId: string): Promise<boolean> {
  try {
    const rule = await prisma.bankRule.findFirst({
      where: { id: ruleId, createdBy: ML_RULE_CREATOR },
    });
    if (!rule) return false;

    await prisma.bankRule.delete({ where: { id: ruleId } });
    logger.info('[MLReconciliation] Deleted pattern', { ruleId });
    return true;
  } catch (error) {
    logger.error('[MLReconciliation] Failed to delete pattern', {
      ruleId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Detect anomalies in transactions
 */
export function detectAnomalies(
  transactions: BankTransaction[],
  historicalAverage: Map<string, number>
): { transactionId: string; type: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; message: string }[] {
  const anomalies: { transactionId: string; type: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; message: string }[] = [];
  const seenDupeKeys = new Set<string>();

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

    // F076 FIX: O(n) hash-based duplicate detection instead of O(n²) nested filter
    const dupeKey = `${tx.amount.toFixed(2)}|${new Date(tx.date).toISOString().slice(0, 10)}`;
    if (seenDupeKeys.has(dupeKey)) {
      anomalies.push({
        transactionId: tx.id,
        type: 'POTENTIAL_DUPLICATE',
        severity: 'MEDIUM',
        message: `Doublon potentiel: même montant et même jour`,
      });
    }
    seenDupeKeys.add(dupeKey);
  }

  return anomalies;
}
