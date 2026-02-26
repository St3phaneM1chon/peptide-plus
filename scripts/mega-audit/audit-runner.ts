#!/usr/bin/env npx ts-node
/**
 * MEGA-AUDIT RUNNER
 * Orchestrates the full 5-layer audit pipeline:
 *   Layer 1: Static analysis (TypeScript, ESLint, Prisma)
 *   Layer 2: AI Triage (classify functions by risk)
 *   Layer 3: Deep Audit (1 function × 1 dimension per prompt)
 *   Layer 4: Adversarial Validation (critic agent)
 *   Layer 5: Report Synthesis
 *
 * Usage:
 *   npx ts-node scripts/mega-audit/audit-runner.ts [options]
 *
 * Options:
 *   --domain <name>     Audit only one domain (e.g., auth, payment)
 *   --dimension <name>  Audit only one dimension (e.g., security)
 *   --skip-static       Skip Layer 1 static analysis
 *   --skip-triage       Skip Layer 2 triage (audit all functions)
 *   --skip-adversarial  Skip Layer 4 adversarial validation
 *   --save-baseline     Save results as new baseline
 *   --diff-baseline     Compare against existing baseline
 *   --dry-run           Extract functions only, don't audit
 *   --max-functions <n> Limit number of functions to audit (for testing)
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import {
  DOMAINS,
  DIMENSIONS,
  OUTPUT_DIR,
  BASELINE_FILE,
  MIN_CONFIDENCE,
  type AuditDimension,
  type AuditFinding,
  type FunctionAuditResult,
} from './audit-config';
import { extractAllFunctions, type ExtractedFunction } from './function-extractor';
import { buildFunctionContext, DIMENSION_PROMPTS, ADVERSARIAL_PROMPT, TRIAGE_PROMPT } from './audit-prompts';
import {
  runAllStaticValidations,
  applyAdversarialVerdicts,
  buildFunctionResult,
  diffBaseline,
  type StaticValidationResult,
  type AdversarialVerdict,
} from './audit-validators';
import { buildReport, writeJsonReport, writeMarkdownReport, writeBaseline } from './audit-reporter';

// =====================================================
// CLI ARGUMENT PARSING
// =====================================================

interface AuditOptions {
  domain?: string;
  dimension?: AuditDimension;
  skipStatic: boolean;
  skipTriage: boolean;
  skipAdversarial: boolean;
  saveBaseline: boolean;
  diffBaseline: boolean;
  dryRun: boolean;
  maxFunctions: number;
}

function parseArgs(): AuditOptions {
  const args = process.argv.slice(2);
  const opts: AuditOptions = {
    skipStatic: false,
    skipTriage: false,
    skipAdversarial: false,
    saveBaseline: false,
    diffBaseline: false,
    dryRun: false,
    maxFunctions: Infinity,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--domain':
        opts.domain = args[++i];
        break;
      case '--dimension':
        opts.dimension = args[++i] as AuditDimension;
        break;
      case '--skip-static':
        opts.skipStatic = true;
        break;
      case '--skip-triage':
        opts.skipTriage = true;
        break;
      case '--skip-adversarial':
        opts.skipAdversarial = true;
        break;
      case '--save-baseline':
        opts.saveBaseline = true;
        break;
      case '--diff-baseline':
        opts.diffBaseline = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--max-functions':
        opts.maxFunctions = parseInt(args[++i], 10);
        break;
    }
  }

  return opts;
}

// =====================================================
// GIT HELPERS
// =====================================================

function getGitCommit(projectRoot: string): string | undefined {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: projectRoot, stdio: 'pipe' }).toString().trim();
  } catch {
    return undefined;
  }
}

// =====================================================
// AUDIT PIPELINE (designed for Claude Code agents)
// =====================================================

/**
 * The audit pipeline is designed to be run by Claude Code agents.
 * Each layer produces structured output that feeds into the next.
 *
 * In practice, Layer 3 (Deep Audit) would be executed by Claude Code
 * using the audit-prompts.ts templates — one prompt per function per dimension.
 * This runner provides the orchestration skeleton and can be used:
 * 1. Standalone with --dry-run to extract and triage functions
 * 2. As a library imported by a Claude Code agent script
 * 3. Manually, running each layer step by step
 */

export async function runAuditPipeline(projectRoot: string, opts: AuditOptions) {
  console.log('='.repeat(60));
  console.log('MEGA-AUDIT PIPELINE');
  console.log('='.repeat(60));
  console.log(`Project: ${projectRoot}`);
  console.log(`Options: ${JSON.stringify(opts, null, 2)}`);
  console.log('');

  const gitCommit = getGitCommit(projectRoot);
  if (gitCommit) console.log(`Git commit: ${gitCommit}`);

  // ----- LAYER 1: Static Analysis -----
  let staticResults: StaticValidationResult[] = [];
  if (!opts.skipStatic) {
    console.log('\n--- LAYER 1: Static Analysis ---');
    staticResults = runAllStaticValidations(projectRoot);
    for (const r of staticResults) {
      console.log(`  ${r.tool}: ${r.passed ? 'PASS' : 'FAIL'} (${r.errors} errors, ${r.warnings} warnings)`);
    }
  }

  // ----- FUNCTION EXTRACTION -----
  console.log('\n--- FUNCTION EXTRACTION ---');
  const domainFilter = opts.domain
    ? { [opts.domain]: DOMAINS[opts.domain] }
    : DOMAINS;

  if (opts.domain && !DOMAINS[opts.domain]) {
    console.error(`Unknown domain: ${opts.domain}. Available: ${Object.keys(DOMAINS).join(', ')}`);
    process.exit(1);
  }

  const { byDomain, total } = await extractAllFunctions(projectRoot, domainFilter);

  if (opts.dryRun) {
    console.log('\n--- DRY RUN: Function Inventory ---');
    const outputDir = path.join(projectRoot, OUTPUT_DIR);
    fs.mkdirSync(outputDir, { recursive: true });

    const inventory: Record<string, { name: string; file: string; kind: string; line: number; exported: boolean }[]> = {};
    for (const [domain, funcs] of Object.entries(byDomain)) {
      inventory[domain] = funcs.map(f => ({
        name: f.name,
        file: f.relativePath,
        kind: f.kind,
        line: f.line,
        exported: f.exported,
      }));
    }

    const inventoryPath = path.join(outputDir, 'function-inventory.json');
    fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
    console.log(`Function inventory written: ${inventoryPath}`);
    console.log(`Total: ${total} functions across ${Object.keys(byDomain).length} domains`);

    // Print summary table
    for (const [domain, funcs] of Object.entries(byDomain)) {
      console.log(`\n${domain} (${funcs.length} functions):`);
      for (const f of funcs.slice(0, 10)) {
        console.log(`  ${f.exported ? 'export ' : '       '}${f.kind} ${f.name} — ${f.relativePath}:${f.line}`);
      }
      if (funcs.length > 10) console.log(`  ... and ${funcs.length - 10} more`);
    }

    return;
  }

  // ----- LAYER 2: Triage -----
  console.log('\n--- LAYER 2: AI Triage ---');
  console.log('(Triage assigns risk levels to prioritize deep audit)');
  console.log('NOTE: In production, triage prompts are sent to Claude via Claude Code agents.');
  console.log('For now, all functions are queued for audit based on domain emphasis.');

  // Collect all functions, limit if needed
  let allFunctions: ExtractedFunction[] = [];
  for (const funcs of Object.values(byDomain)) {
    allFunctions.push(...funcs);
  }
  if (opts.maxFunctions < allFunctions.length) {
    console.log(`Limiting to ${opts.maxFunctions} functions (of ${allFunctions.length})`);
    allFunctions = allFunctions.slice(0, opts.maxFunctions);
  }

  // ----- LAYER 3: Deep Audit -----
  console.log('\n--- LAYER 3: Deep Audit ---');
  console.log(`Auditing ${allFunctions.length} functions across ${opts.dimension ? '1' : '5'} dimensions`);
  console.log('');

  // Generate audit task manifest (for Claude Code agents to execute)
  const dimensionsToAudit = opts.dimension ? [opts.dimension] : DIMENSIONS;
  const auditTasks: {
    functionName: string;
    file: string;
    domain: string;
    dimension: AuditDimension;
    context: string;
    systemPrompt: string;
    userPrompt: string;
  }[] = [];

  for (const fn of allFunctions) {
    const context = buildFunctionContext(fn);
    for (const dim of dimensionsToAudit) {
      const promptConfig = DIMENSION_PROMPTS[dim];
      auditTasks.push({
        functionName: fn.name,
        file: fn.relativePath,
        domain: fn.domain || 'unknown',
        dimension: dim,
        context,
        systemPrompt: promptConfig.systemPrompt,
        userPrompt: promptConfig.userPromptTemplate(context),
      });
    }
  }

  // Save audit task manifest
  const outputDir = path.join(projectRoot, OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });
  const manifestPath = path.join(outputDir, 'audit-tasks.json');
  fs.writeFileSync(manifestPath, JSON.stringify(auditTasks, null, 2));
  console.log(`Audit task manifest written: ${manifestPath}`);
  console.log(`Total tasks: ${auditTasks.length} (${allFunctions.length} functions x ${dimensionsToAudit.length} dimensions)`);

  // Generate execution instructions
  const instructionsPath = path.join(outputDir, 'EXECUTE.md');
  const instructions = `# Mega-Audit Execution Instructions

## Generated: ${new Date().toISOString()}
## Tasks: ${auditTasks.length}

## How to Execute

### Option A: Claude Code Agents (Recommended)
Use Claude Code with the Task tool to process audit-tasks.json:
1. Read audit-tasks.json
2. For each task, send systemPrompt + userPrompt to Claude
3. Parse the JSON response using the dimension's parseResponse function
4. Collect all findings into a FunctionAuditResult[]
5. Run adversarial validation on critical/high findings
6. Generate the report

### Option B: Manual (one function at a time)
For each entry in audit-tasks.json:
1. Copy the systemPrompt as the system message
2. Copy the userPrompt as the user message
3. Send to Claude API
4. Parse the JSON response
5. Collect findings

### Option C: Batch Script
\`\`\`bash
# Process with Claude API
for task in $(cat .audit_results/mega-audit/audit-tasks.json | jq -c '.[]'); do
  echo "$task" | jq -r '.userPrompt' | claude --system "$(echo "$task" | jq -r '.systemPrompt')"
done
\`\`\`

## After Execution
1. Save all findings as audit-results.json
2. Run: npx ts-node scripts/mega-audit/audit-runner.ts --save-baseline
3. Review audit-report.md
`;
  fs.writeFileSync(instructionsPath, instructions);

  // ----- LAYER 5: Report -----
  console.log('\n--- LAYER 5: Report Generation ---');
  console.log('(Report will be generated after audit tasks are executed)');
  console.log(`Output directory: ${outputDir}`);
  console.log('');
  console.log('Pipeline preparation complete.');
  console.log(`Next step: Execute ${auditTasks.length} audit tasks using Claude Code agents.`);

  // Return manifest for programmatic use
  return {
    staticResults,
    functions: allFunctions,
    auditTasks,
    outputDir,
    gitCommit,
  };
}

// =====================================================
// RESULT PROCESSOR (called after agents complete)
// =====================================================

/**
 * Process raw audit results (from Claude Code agents) into final report.
 * Call this after all audit tasks have been executed.
 */
export async function processAuditResults(
  projectRoot: string,
  rawResults: Map<string, AuditFinding[]>, // key: "file:functionName"
  allFunctions: ExtractedFunction[],
  staticResults: StaticValidationResult[],
  opts: AuditOptions,
) {
  console.log('\n--- Processing Audit Results ---');

  const functionResults: FunctionAuditResult[] = [];

  for (const fn of allFunctions) {
    const key = `${fn.relativePath}:${fn.name}`;
    const findings = rawResults.get(key) || [];

    // Filter by confidence
    const filteredFindings = findings.filter(f => f.confidence >= MIN_CONFIDENCE);

    const domainConfig = fn.domain ? DOMAINS[fn.domain] : undefined;
    const emphasized = domainConfig?.emphasize || [];

    const result = buildFunctionResult(
      fn.name,
      fn.relativePath,
      fn.line,
      fn.endLine,
      fn.domain || 'unknown',
      filteredFindings,
      emphasized,
    );

    functionResults.push(result);
  }

  // Build and write reports
  const gitCommit = getGitCommit(projectRoot);
  const report = buildReport(projectRoot, functionResults, gitCommit);
  writeJsonReport(projectRoot, report);
  writeMarkdownReport(projectRoot, report, staticResults);

  if (opts.saveBaseline) {
    writeBaseline(projectRoot, functionResults);
  }

  if (opts.diffBaseline) {
    const baselinePath = path.join(projectRoot, OUTPUT_DIR, BASELINE_FILE);
    const diff = diffBaseline(functionResults, baselinePath);
    console.log(`\nBaseline diff: ${diff.newFindings.length} new, ${diff.resolvedFindings.length} resolved, ${diff.unchangedCount} unchanged`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Functions: ${report.totalFunctions}`);
  console.log(`Total findings: ${report.totalFindings}`);
  console.log(`  Critical: ${report.bySeverity.critical}`);
  console.log(`  High: ${report.bySeverity.high}`);
  console.log(`  Medium: ${report.bySeverity.medium}`);
  console.log(`  Low: ${report.bySeverity.low}`);
  console.log(`  Info: ${report.bySeverity.info}`);
  console.log(`\nReports: ${path.join(projectRoot, OUTPUT_DIR)}/`);

  return report;
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  const projectRoot = path.resolve(__dirname, '../..');
  const opts = parseArgs();

  try {
    await runAuditPipeline(projectRoot, opts);
  } catch (err) {
    console.error('Audit pipeline failed:', err);
    process.exit(1);
  }
}

main().catch(console.error);
