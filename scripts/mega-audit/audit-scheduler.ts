/**
 * AUDIT SCHEDULER
 * Determines which domain to audit next based on:
 * 1. Days since last audit of each domain
 * 2. Number of changed files since last audit
 * 3. Severity of open findings
 * 4. Fixed rotation schedule
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DOMAINS, DOMAIN_RISK_WEIGHTS } from './audit-config';

const RESULTS_DIR = path.resolve('.audit_results');
const WEEKLY_DIR = path.join(RESULTS_DIR, 'weekly');

interface DomainPriority {
  domain: string;
  name: string;
  daysSinceAudit: number;
  changedFilesSinceAudit: number;
  openFindings: number;
  riskWeight: number;
  priorityScore: number;
}

/**
 * Get the date of the last audit for a domain.
 */
function getLastAuditDate(domain: string): Date | null {
  if (!fs.existsSync(WEEKLY_DIR)) return null;

  const files = fs.readdirSync(WEEKLY_DIR)
    .filter(f => f.includes(`-${domain}.json`))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  try {
    const data = JSON.parse(fs.readFileSync(path.join(WEEKLY_DIR, files[0]), 'utf-8'));
    return new Date(data.generatedAt || data.date);
  } catch {
    // Extract date from filename (e.g., 2026-W14-auth.json)
    const match = files[0].match(/(\d{4})-W(\d+)/);
    if (match) {
      const year = parseInt(match[1]);
      const week = parseInt(match[2]);
      const d = new Date(year, 0, 1 + (week - 1) * 7);
      return d;
    }
    return null;
  }
}

/**
 * Count files changed in a domain since a given date.
 */
function getChangedFileCount(domain: string, sinceDate: Date | null): number {
  const config = DOMAINS[domain];
  if (!config) return 0;

  const since = sinceDate
    ? sinceDate.toISOString().slice(0, 10)
    : new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10); // Default: 90 days ago

  try {
    let count = 0;
    for (const pattern of config.include) {
      // Convert glob to simple path prefix
      const prefix = pattern.replace(/\*\*.*/, '').replace(/\*.*/, '');
      if (!prefix) continue;
      try {
        const output = execSync(
          `git log --since="${since}" --name-only --pretty=format: -- "${prefix}" 2>/dev/null | sort -u | wc -l`,
          { encoding: 'utf-8' }
        );
        count += parseInt(output.trim()) || 0;
      } catch {
        // git command failed, skip
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Count open findings for a domain from the latest audit result.
 */
function getOpenFindingsCount(domain: string): number {
  if (!fs.existsSync(WEEKLY_DIR)) return 0;

  const files = fs.readdirSync(WEEKLY_DIR)
    .filter(f => f.includes(`-${domain}.json`))
    .sort()
    .reverse();

  if (files.length === 0) return 0;

  try {
    const data = JSON.parse(fs.readFileSync(path.join(WEEKLY_DIR, files[0]), 'utf-8'));
    return (data.findings || []).filter((f: { status?: string }) => f.status !== 'fixed' && f.status !== 'false_positive').length;
  } catch {
    return 0;
  }
}

/**
 * Calculate priority score for each domain and return sorted list.
 * Higher score = should be audited sooner.
 */
export function calculatePriorities(): DomainPriority[] {
  const now = Date.now();
  const priorities: DomainPriority[] = [];

  for (const [key, config] of Object.entries(DOMAINS)) {
    const lastAudit = getLastAuditDate(key);
    const daysSinceAudit = lastAudit
      ? Math.floor((now - lastAudit.getTime()) / 86400000)
      : 999; // Never audited

    const changedFiles = getChangedFileCount(key, lastAudit);
    const openFindings = getOpenFindingsCount(key);
    const riskWeight = DOMAIN_RISK_WEIGHTS[key] ?? 1.0;

    // Priority formula:
    // - Days since audit: +1 per day (capped at 100)
    // - Changed files: +2 per file (high-change = needs re-audit)
    // - Open findings: +3 per finding (unresolved issues = urgent)
    // - Risk weight: multiplier (auth/payment = 2x priority)
    const priorityScore = (
      Math.min(daysSinceAudit, 100) +
      changedFiles * 2 +
      openFindings * 3
    ) * riskWeight;

    priorities.push({
      domain: key,
      name: config.name,
      daysSinceAudit,
      changedFilesSinceAudit: changedFiles,
      openFindings,
      riskWeight,
      priorityScore,
    });
  }

  return priorities.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Get the next domain to audit (highest priority).
 */
export function getNextDomain(): DomainPriority {
  const priorities = calculatePriorities();
  return priorities[0];
}

/**
 * Print the current priority dashboard.
 */
export function printDashboard(): void {
  const priorities = calculatePriorities();

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT FORGE — Domain Priority                     ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║ Domain              │ Days │ Changed │ Open │ Risk │ Priority       ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');

  for (const p of priorities) {
    const name = p.name.slice(0, 20).padEnd(20);
    const days = String(p.daysSinceAudit).padStart(4);
    const changed = String(p.changedFilesSinceAudit).padStart(7);
    const open = String(p.openFindings).padStart(4);
    const risk = p.riskWeight.toFixed(1).padStart(4);
    const score = p.priorityScore.toFixed(0).padStart(8);
    console.log(`║ ${name}│${days} │${changed} │${open} │${risk} │${score}       ║`);
  }

  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`\n→ Next audit: ${priorities[0].name} (${priorities[0].domain})`);
}

// CLI entry point
if (require.main === module) {
  printDashboard();
}
