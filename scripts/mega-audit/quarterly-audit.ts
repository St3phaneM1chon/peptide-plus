#!/usr/bin/env npx tsx
/**
 * AUDIT FORGE — Quarterly Mega Audit Orchestrator
 * Full audit of ALL 14 domains with consensus + mutation testing.
 *
 * Usage: npx tsx scripts/mega-audit/quarterly-audit.ts
 *
 * This generates manifests for each domain. The actual Claude Code
 * audit execution happens domain-by-domain over 3-5 days.
 */

import { DOMAINS, DOMAIN_RISK_WEIGHTS } from './audit-config';
import { generateThreatPreamble } from './threat-models';
import { ensureDirectories, saveBaseline } from './historical-tracker';
import * as fs from 'fs';
import * as path from 'path';

const RESULTS_DIR = path.resolve('.audit_results');
const now = new Date();
const quarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;

console.log('🔍 AUDIT FORGE — Quarterly Mega Audit');
console.log(`📅 Quarter: ${quarter}`);
console.log(`📂 Domains: ${Object.keys(DOMAINS).length}`);
console.log('');

ensureDirectories();

// ── Generate manifests for all domains ─────────────────────────

const manifests: Array<{ domain: string; name: string; priority: number; threatModel: string }> = [];

for (const [key, config] of Object.entries(DOMAINS)) {
  const threatModel = generateThreatPreamble(key);
  const priority = DOMAIN_RISK_WEIGHTS[key] ?? 1.0;

  const manifest = {
    domain: key,
    domainName: config.name,
    quarter,
    date: now.toISOString().slice(0, 10),
    type: 'quarterly',
    patterns: config.include,
    excludePatterns: config.exclude ?? [],
    emphasizedDimensions: config.emphasize ?? [],
    threatModel,
    priority,
    pipeline: {
      pass1: 'Deep audit per function (5 dimensions)',
      pass2: 'Adversarial critic review',
      pass3: 'Cross-module consistency (after all domains)',
      consensus: 'Triple-run for Critical/High findings',
      mutation: 'Deliberate bug injection to test audit quality',
    },
  };

  const manifestPath = path.join(
    RESULTS_DIR, 'weekly',
    `${now.toISOString().slice(0, 10)}-${key}-quarterly-manifest.json`
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  manifests.push({ domain: key, name: config.name, priority, threatModel: threatModel ? 'YES' : 'NO' });
}

// ── Print execution plan ───────────────────────────────────────

// Sort by priority (highest first)
manifests.sort((a, b) => b.priority - a.priority);

console.log('═══════════════════════════════════════════════════════════════');
console.log('QUARTERLY MEGA AUDIT — EXECUTION PLAN');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('| Day | Domain | Priority | Threat Model |');
console.log('|-----|--------|----------|--------------|');

let day = 1;
let domainsPerDay = 3;
for (let i = 0; i < manifests.length; i++) {
  const m = manifests[i];
  console.log(`| ${day}   | ${m.name.slice(0, 30).padEnd(30)} | ${m.priority.toFixed(1).padStart(4)}x    | ${m.threatModel.padStart(3)}          |`);
  if ((i + 1) % domainsPerDay === 0) day++;
}

console.log('');
console.log(`Total domains: ${manifests.length}`);
console.log(`Estimated duration: ${day} days`);
console.log(`Manifests saved to: ${RESULTS_DIR}/weekly/`);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('EXECUTION ORDER:');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

for (const [i, m] of manifests.entries()) {
  console.log(`${i + 1}. "audit domain ${m.domain}"`);
}

console.log('');
console.log('After all domains audited:');
console.log('  - "audit monthly" (cross-module + scoring)');
console.log('  - Compare with previous quarter baseline');
console.log('  - Run mutation testing: npx tsx scripts/mega-audit/mutation-tester.ts');
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
