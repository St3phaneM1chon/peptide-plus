#!/usr/bin/env npx tsx
/**
 * AUDIT FORGE — Weekly Audit Orchestrator
 * Runs a deep audit on ONE domain (the highest priority from the scheduler).
 *
 * Usage:
 *   npx tsx scripts/mega-audit/weekly-audit.ts              # Auto-select highest priority domain
 *   npx tsx scripts/mega-audit/weekly-audit.ts --domain auth # Audit specific domain
 *   npx tsx scripts/mega-audit/weekly-audit.ts --dashboard   # Show priority dashboard only
 *
 * Pipeline:
 *   1. Select domain (scheduler or explicit)
 *   2. Extract functions (AST via function-extractor.ts)
 *   3. Run static analysis (pre-push checks)
 *   4. Log domain audit manifest for Claude Code execution
 *   5. Save results to .audit_results/weekly/
 */

import { getNextDomain, printDashboard, calculatePriorities } from './audit-scheduler';
import { DOMAINS } from './audit-config';
import { generateThreatPreamble } from './threat-models';
import { ensureDirectories } from './historical-tracker';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const dashboardOnly = args.includes('--dashboard');
const explicitDomain = args.find(a => a.startsWith('--domain'))
  ? args[args.indexOf('--domain') + 1] ?? args.find(a => a.startsWith('--domain='))?.split('=')[1]
  : null;

// ── Dashboard Mode ─────────────────────────────────────────────

if (dashboardOnly) {
  printDashboard();
  process.exit(0);
}

// ── Select Domain ──────────────────────────────────────────────

const selectedDomain = explicitDomain ?? getNextDomain().domain;
const domainConfig = DOMAINS[selectedDomain];

if (!domainConfig) {
  console.error(`Unknown domain: ${selectedDomain}`);
  console.error(`Available: ${Object.keys(DOMAINS).join(', ')}`);
  process.exit(1);
}

console.log(`\n🔍 AUDIT FORGE — Weekly Deep Audit`);
console.log(`📂 Domain: ${domainConfig.name} (${selectedDomain})`);
console.log(`📋 Patterns: ${domainConfig.include.join(', ')}`);
console.log(`⚡ Emphasized: ${domainConfig.emphasize?.join(', ') ?? 'all'}`);
console.log('');

// ── Generate Threat Model ──────────────────────────────────────

const threatPreamble = generateThreatPreamble(selectedDomain);
if (threatPreamble) {
  console.log('🛡️  Threat Model:');
  console.log(threatPreamble.split('\n').map(l => `   ${l}`).join('\n'));
  console.log('');
}

// ── Generate Audit Manifest ────────────────────────────────────

ensureDirectories();

const manifest = {
  domain: selectedDomain,
  domainName: domainConfig.name,
  date: new Date().toISOString().slice(0, 10),
  patterns: domainConfig.include,
  excludePatterns: domainConfig.exclude ?? [],
  emphasizedDimensions: domainConfig.emphasize ?? [],
  threatModel: threatPreamble,
  pipeline: {
    pass1: 'Deep audit per function (Generator)',
    pass2: 'Adversarial review (Critic)',
    pass3: 'Cross-module check (after all domains complete)',
    consensus: 'Triple-run for Critical/High',
  },
  promptTemplate: {
    persona: `Tu es un pentester senior avec 20 ans d'experience specialise en ${domainConfig.name}.`,
    evidenceGate: 'Chaque finding DOIT inclure: exploitSteps, testCase, suggestedFix.',
    outputFormat: 'JSON avec: file, line, code, severity, category, title, exploitSteps[], testCase, suggestedFix, cweId, confidence',
  },
};

const manifestPath = path.resolve(`.audit_results/weekly/${manifest.date}-${selectedDomain}-manifest.json`);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`📄 Manifest saved: ${manifestPath}`);
console.log('');

// ── Instructions for Claude Code ───────────────────────────────

console.log('═══════════════════════════════════════════════════════════════');
console.log('INSTRUCTIONS POUR CLAUDE CODE:');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`1. Lire TOUS les fichiers correspondant a: ${domainConfig.include.join(', ')}`);
console.log(`2. Pour CHAQUE fonction/handler, appliquer le prompt 4 couches:`);
console.log(`   - Persona: pentester senior ${domainConfig.name}`);
console.log(`   - Threat model: ${threatPreamble ? 'OUI (voir manifest)' : 'generique'}`);
console.log(`   - Evidence gate: exploitSteps + testCase obligatoires`);
console.log(`   - Negative examples: voir .claude/rules/mega-audit-recurring.md`);
console.log(`3. Apres PASS 1, lancer PASS 2 (Critic adversarial)`);
console.log(`4. Pour findings Critical/High, appliquer consensus (3 runs)`);
console.log(`5. Sauvegarder resultats dans .audit_results/weekly/`);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');

// ── Show Priority Dashboard ────────────────────────────────────

console.log('\n📊 Domain Priority Dashboard:');
printDashboard();
