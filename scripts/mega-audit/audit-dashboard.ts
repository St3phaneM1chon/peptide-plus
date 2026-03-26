#!/usr/bin/env npx tsx
/**
 * AUDIT FORGE — Dashboard Generator
 * Generates a comprehensive markdown dashboard from audit results.
 *
 * Usage: npx tsx scripts/mega-audit/audit-dashboard.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { DOMAINS, DOMAIN_RISK_WEIGHTS, calculateGlobalScore, Grade } from './audit-config';
import { getTrends, detectRegressions, getLatestBaseline } from './historical-tracker';

const RESULTS_DIR = path.resolve('.audit_results');
const WEEKLY_DIR = path.join(RESULTS_DIR, 'weekly');

interface DomainSummary {
  domain: string;
  name: string;
  score: number;
  grade: Grade;
  lastAudit: string | null;
  findingsCount: number;
  criticals: number;
  riskWeight: number;
}

function getDomainSummaries(): DomainSummary[] {
  const summaries: DomainSummary[] = [];

  for (const [key, config] of Object.entries(DOMAINS)) {
    let score = 0;
    let grade: Grade = 'F';
    let lastAudit: string | null = null;
    let findingsCount = 0;
    let criticals = 0;

    // Read latest weekly result
    if (fs.existsSync(WEEKLY_DIR)) {
      const files = fs.readdirSync(WEEKLY_DIR)
        .filter(f => f.includes(`-${key}.json`) || f.includes(`-${key}-`))
        .sort()
        .reverse();

      if (files.length > 0) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(WEEKLY_DIR, files[0]), 'utf-8'));
          score = data.score ?? 0;
          grade = data.grade ?? 'F';
          lastAudit = data.date ?? null;
          findingsCount = data.findings?.length ?? data.findingsCount ?? 0;
          criticals = data.criticals ?? 0;
        } catch {
          // Corrupted file
        }
      }
    }

    summaries.push({
      domain: key,
      name: config.name,
      score,
      grade,
      lastAudit,
      findingsCount,
      criticals,
      riskWeight: DOMAIN_RISK_WEIGHTS[key] ?? 1.0,
    });
  }

  return summaries.sort((a, b) => a.score - b.score);
}

function generateDashboard(): string {
  const summaries = getDomainSummaries();
  const regressions = detectRegressions();
  const baseline = getLatestBaseline();

  const domainScores: Record<string, number> = {};
  for (const s of summaries) {
    if (s.score > 0) domainScores[s.domain] = s.score;
  }

  const global = Object.keys(domainScores).length > 0
    ? calculateGlobalScore(domainScores)
    : { score: 0, grade: 'F' as Grade };

  const audited = summaries.filter(s => s.lastAudit);
  const notAudited = summaries.filter(s => !s.lastAudit);

  const lines: string[] = [];

  lines.push('# Audit Forge — Platform Dashboard');
  lines.push(`Generated: ${new Date().toISOString().slice(0, 16)}`);
  lines.push('');

  // Global score
  lines.push(`## Global Score: ${global.score}/100 (${global.grade})`);
  lines.push(`Domains audited: ${audited.length}/${summaries.length}`);
  lines.push('');

  // Regressions alert
  if (regressions.length > 0) {
    lines.push('## ⚠️ REGRESSIONS DETECTED');
    for (const r of regressions) {
      lines.push(`- **${r.domain}**: ${r.previousScore} → ${r.currentScore} (${r.delta})`);
    }
    lines.push('');
  }

  // Domain scores table
  lines.push('## Domain Scores');
  lines.push('');
  lines.push('| Domain | Score | Grade | Findings | Criticals | Risk | Last Audit |');
  lines.push('|--------|-------|-------|----------|-----------|------|------------|');

  for (const s of summaries) {
    const scoreStr = s.lastAudit ? `${s.score}/100` : '—';
    const gradeStr = s.lastAudit ? s.grade : '—';
    const prevScore = baseline?.[s.domain];
    const delta = prevScore && s.lastAudit ? s.score - (typeof prevScore === 'object' ? prevScore.score : prevScore) : 0;
    const deltaStr = delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta})` : '';

    lines.push(
      `| ${s.name.slice(0, 30).padEnd(30)} | ${scoreStr}${deltaStr} | ${gradeStr} | ${s.findingsCount} | ${s.criticals} | ${s.riskWeight}x | ${s.lastAudit ?? 'Never'} |`
    );
  }

  // Not yet audited
  if (notAudited.length > 0) {
    lines.push('');
    lines.push('## Not Yet Audited');
    for (const s of notAudited) {
      lines.push(`- ${s.name} (${s.domain}) — risk weight: ${s.riskWeight}x`);
    }
  }

  // Trends (last 3 months)
  const trends = getTrends(undefined, 90);
  if (trends.length > 0) {
    lines.push('');
    lines.push('## Score Trends (Last 90 Days)');
    lines.push('');

    // Group by domain, show latest 5 entries
    const byDomain = new Map<string, typeof trends>();
    for (const t of trends) {
      if (!byDomain.has(t.domain)) byDomain.set(t.domain, []);
      byDomain.get(t.domain)!.push(t);
    }

    for (const [domain, entries] of byDomain) {
      const recent = entries.sort((a, b) => a.date.localeCompare(b.date)).slice(-5);
      const sparkline = recent.map(e => {
        if (e.score >= 90) return '█';
        if (e.score >= 80) return '▇';
        if (e.score >= 70) return '▅';
        if (e.score >= 50) return '▃';
        return '▁';
      }).join('');
      lines.push(`- **${domain}**: ${sparkline} (${recent[recent.length - 1]?.score ?? '?'})`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated by Audit Forge v5.0 | Koraline SaaS Platform*');

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────

const dashboard = generateDashboard();
const outputPath = path.join(RESULTS_DIR, 'DASHBOARD.md');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}
fs.writeFileSync(outputPath, dashboard);

console.log(dashboard);
console.log(`\nSaved to: ${outputPath}`);
