/**
 * AUDIT FORGE — Scoring Engine
 * Unified 0-100 scoring model with normalization, caps, and domain weighting.
 */

import {
  AuditFinding,
  Severity,
  Grade,
  SEVERITY_WEIGHTS,
  SEVERITY_CAPS,
  DOMAIN_RISK_WEIGHTS,
  calculateDomainScore,
  calculateGlobalScore,
} from './audit-config';

// Re-export for convenience
export { calculateDomainScore, calculateGlobalScore };

/**
 * Score a single function based on its findings.
 */
export function scoreFunctionFindings(findings: AuditFinding[]): {
  score: number;
  grade: Grade;
  criticals: number;
  highs: number;
  mediums: number;
  lows: number;
} {
  const confirmed = findings.filter(f => f.criticVerdict !== 'false_positive');

  let penalty = 0;
  let criticals = 0, highs = 0, mediums = 0, lows = 0;

  for (const f of confirmed) {
    const weight = SEVERITY_WEIGHTS[f.severity] ?? 0;
    penalty += weight * (f.confidence ?? 0.7);

    switch (f.severity) {
      case 'critical': criticals++; break;
      case 'high': highs++; break;
      case 'medium': mediums++; break;
      case 'low': lows++; break;
    }
  }

  const score = Math.max(0, Math.round(100 - penalty * 5));
  const grade: Grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 50 ? 'D' : 'F';

  return { score, grade, criticals, highs, mediums, lows };
}

/**
 * Generate a delta comparison between two audit runs.
 */
export function compareDomainAudits(
  previous: { findings: AuditFinding[]; score: number },
  current: { findings: AuditFinding[]; score: number }
): {
  scoreDelta: number;
  newFindings: AuditFinding[];
  resolvedFindings: AuditFinding[];
  regressions: AuditFinding[];
  isRegression: boolean;
} {
  const prevIds = new Set(previous.findings.map(f => f.id));
  const currIds = new Set(current.findings.map(f => f.id));

  const newFindings = current.findings.filter(f => !prevIds.has(f.id));
  const resolvedFindings = previous.findings.filter(f => !currIds.has(f.id));

  // Regressions: findings that were previously fixed but reappeared
  const regressions = current.findings.filter(f => {
    const prev = previous.findings.find(p => p.id === f.id);
    return prev && prev.status === 'fixed';
  });

  const scoreDelta = current.score - previous.score;
  const isRegression = scoreDelta <= -5;

  return { scoreDelta, newFindings, resolvedFindings, regressions, isRegression };
}

/**
 * Generate a markdown score dashboard for all domains.
 */
export function generateScoreDashboard(
  domainScores: Record<string, { score: number; grade: Grade; findingsCount: number; functionsAudited: number }>,
  previousScores?: Record<string, number>
): string {
  const lines: string[] = [];
  lines.push('# Audit Forge — Score Dashboard');
  lines.push(`Generated: ${new Date().toISOString().slice(0, 16)}`);
  lines.push('');
  lines.push('| Domain | Score | Grade | Delta | Findings | Functions |');
  lines.push('|--------|-------|-------|-------|----------|-----------|');

  const scores: Record<string, number> = {};

  for (const [domain, data] of Object.entries(domainScores).sort((a, b) => a[1].score - b[1].score)) {
    const prev = previousScores?.[domain];
    const delta = prev !== undefined ? data.score - prev : 0;
    const deltaStr = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '=';
    const alert = delta <= -5 ? ' ⚠️' : '';

    lines.push(`| ${domain.padEnd(14)} | ${String(data.score).padStart(3)}/100 | ${data.grade} | ${deltaStr.padStart(5)}${alert} | ${String(data.findingsCount).padStart(8)} | ${String(data.functionsAudited).padStart(9)} |`);
    scores[domain] = data.score;
  }

  const global = calculateGlobalScore(scores);
  lines.push('');
  lines.push(`**Global Score: ${global.score}/100 (${global.grade})**`);

  if (previousScores) {
    const prevGlobal = calculateGlobalScore(previousScores);
    const globalDelta = global.score - prevGlobal.score;
    lines.push(`Global Delta: ${globalDelta > 0 ? '+' : ''}${globalDelta} (previous: ${prevGlobal.score})`);
  }

  return lines.join('\n');
}

/**
 * Generate a finding lifecycle summary.
 */
export function generateLifecycleSummary(findings: AuditFinding[]): string {
  const open = findings.filter(f => f.status === 'open' || !f.status);
  const fixed = findings.filter(f => f.status === 'fixed');
  const wontfix = findings.filter(f => f.status === 'wontfix');
  const falsePositive = findings.filter(f => f.status === 'false_positive' || f.criticVerdict === 'false_positive');
  const regressions = findings.filter(f => (f.regressionCount ?? 0) > 0);

  return [
    `## Finding Lifecycle`,
    `- Open: ${open.length}`,
    `- Fixed: ${fixed.length}`,
    `- Won't Fix: ${wontfix.length}`,
    `- False Positive: ${falsePositive.length}`,
    `- Regressions: ${regressions.length}`,
    `- Total tracked: ${findings.length}`,
  ].join('\n');
}
