/**
 * AUDIT FORGE — Consensus Engine
 * Mitigates LLM non-determinism for Critical/High findings.
 *
 * Strategy:
 * - For Critical/High findings from Pass 1, re-run the audit 2 more times
 * - Finding confirmed by 3/3 runs = high confidence
 * - Finding confirmed by 2/3 runs = medium confidence (downgrade 1 level)
 * - Finding confirmed by 1/3 runs = rejected (hallucination)
 *
 * "Non-determinism is the #1 enemy of LLM-based code audit" — ICSE 2025
 */

import { AuditFinding, Severity } from './audit-config';

/** Match findings across runs by file + line + category (fuzzy) */
function findingsMatch(a: AuditFinding, b: AuditFinding): boolean {
  // Exact match: same file + same line range + same category
  if (a.file === b.file && Math.abs(a.line - b.line) <= 3 && a.dimension === b.dimension) {
    return true;
  }
  // Fuzzy match: same file + similar title (Levenshtein < 30% of length)
  if (a.file === b.file && a.dimension === b.dimension) {
    const titleA = a.title.toLowerCase();
    const titleB = b.title.toLowerCase();
    // Simple: check if >60% of words overlap
    const wordsA = new Set(titleA.split(/\s+/));
    const wordsB = new Set(titleB.split(/\s+/));
    const overlap = [...wordsA].filter(w => wordsB.has(w)).length;
    const maxLen = Math.max(wordsA.size, wordsB.size);
    return maxLen > 0 && overlap / maxLen > 0.6;
  }
  return false;
}

/**
 * Apply consensus across multiple audit runs.
 * Returns findings with consensus metadata added.
 */
export function applyConsensus(
  runs: AuditFinding[][],
  options: { minRuns?: number } = {}
): AuditFinding[] {
  const totalRuns = runs.length;
  const minRuns = options.minRuns ?? 2;

  if (totalRuns < 2) {
    // Single run — no consensus possible, return as-is
    return runs[0]?.map(f => ({
      ...f,
      consensusRuns: 1,
      consensusConfidence: 'medium' as const,
    })) ?? [];
  }

  // Use first run as the reference
  const reference = runs[0];
  const results: AuditFinding[] = [];

  for (const finding of reference) {
    // Only apply consensus to Critical/High (others pass through)
    if (finding.severity !== 'critical' && finding.severity !== 'high') {
      results.push({ ...finding, consensusRuns: 1, consensusConfidence: 'medium' });
      continue;
    }

    // Count how many other runs confirm this finding
    let confirmations = 1; // First run always confirms itself
    for (let i = 1; i < totalRuns; i++) {
      const hasMatch = runs[i].some(f => findingsMatch(finding, f));
      if (hasMatch) confirmations++;
    }

    if (confirmations >= totalRuns) {
      // All runs agree — high confidence
      results.push({ ...finding, consensusRuns: confirmations, consensusConfidence: 'high' });
    } else if (confirmations >= minRuns) {
      // Majority agrees — medium confidence, downgrade severity
      const downgraded: Severity = finding.severity === 'critical' ? 'high' : 'medium';
      results.push({
        ...finding,
        severity: downgraded,
        consensusRuns: confirmations,
        consensusConfidence: 'medium',
      });
    } else {
      // Only 1 run found this — reject as hallucination
      results.push({
        ...finding,
        consensusRuns: confirmations,
        consensusConfidence: 'rejected',
        criticVerdict: 'false_positive',
      });
    }
  }

  // Also check for findings that appear in other runs but NOT in the reference
  for (let i = 1; i < totalRuns; i++) {
    for (const finding of runs[i]) {
      if (finding.severity !== 'critical' && finding.severity !== 'high') continue;
      const alreadyTracked = results.some(r => findingsMatch(r, finding));
      if (alreadyTracked) continue;

      // This finding was missed by the reference run — check consensus
      let confirmations = 1;
      for (let j = 0; j < totalRuns; j++) {
        if (j === i) continue;
        if (runs[j].some(f => findingsMatch(finding, f))) confirmations++;
      }

      if (confirmations >= minRuns) {
        results.push({
          ...finding,
          consensusRuns: confirmations,
          consensusConfidence: confirmations >= totalRuns ? 'high' : 'medium',
        });
      }
    }
  }

  return results;
}

/**
 * Generate a consensus report summary.
 */
export function generateConsensusReport(findings: AuditFinding[]): string {
  const high = findings.filter(f => f.consensusConfidence === 'high');
  const medium = findings.filter(f => f.consensusConfidence === 'medium');
  const rejected = findings.filter(f => f.consensusConfidence === 'rejected');

  return [
    '## Consensus Report',
    `- High confidence (all runs agree): ${high.length} findings`,
    `- Medium confidence (majority agree): ${medium.length} findings`,
    `- Rejected (single-run only): ${rejected.length} hallucinations filtered`,
    `- Consensus rate: ${findings.length > 0 ? Math.round(((high.length + medium.length) / findings.length) * 100) : 0}%`,
  ].join('\n');
}
