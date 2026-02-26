# Mega-Audit System

Exhaustive, reproducible audit system for peptide-plus. Audits every exported function across 5 dimensions with adversarial validation.

## Architecture (5 Layers)

```
Layer 1: Static Analysis ─── TypeScript, ESLint, Prisma validate
Layer 2: AI Triage ───────── Classify functions by risk (high/medium/low)
Layer 3: Deep Audit ──────── 1 function × 1 dimension per prompt
Layer 4: Adversarial ─────── Independent critic challenges findings
Layer 5: Synthesis ───────── Consolidated report (JSON + Markdown)
```

## 10 Golden Rules

1. **ONE function per prompt, ONE dimension per pass**
2. **Granularity: function with context envelope** (imports, types, callers)
3. **Builder never reviews own work** (separate critic agent)
4. **Evidence mandate** — exact lines, concrete scenarios, proposed fix
5. **Multi-pass** — static → triage → deep → adversarial → report
6. **Weighted scoring** (Impact × Probability)
7. **Specialist agents** per dimension
8. **Baseline + differential** (git diff since last audit)
9. **Few-shot examples** of real CVEs in prompts
10. **Noise filtering** with confidence thresholds

## 5 Audit Dimensions

| Dimension | Focus |
|-----------|-------|
| Security | Injection, auth bypass, data exposure, SSRF, XSS, mass assignment |
| Performance | N+1 queries, unbounded fetches, missing cache, memory leaks |
| Reliability | Unhandled errors, race conditions, silent failures, missing transactions |
| Maintainability | Complexity, duplication, missing types, dead code |
| Compliance | RGPD, PCI-DSS, CASL, WCAG |

## 8 Business Domains

auth, payment, accounting, ecommerce, admin, user, api_core, i18n

## Quick Start

```bash
# 1. Dry run — extract all functions and generate inventory
npx ts-node scripts/mega-audit/audit-runner.ts --dry-run

# 2. Audit one domain
npx ts-node scripts/mega-audit/audit-runner.ts --domain auth

# 3. Audit one dimension across all domains
npx ts-node scripts/mega-audit/audit-runner.ts --dimension security

# 4. Full audit (all domains, all dimensions)
npx ts-node scripts/mega-audit/audit-runner.ts

# 5. Save baseline for future diffs
npx ts-node scripts/mega-audit/audit-runner.ts --save-baseline

# 6. Compare against baseline
npx ts-node scripts/mega-audit/audit-runner.ts --diff-baseline

# 7. Limit scope for testing
npx ts-node scripts/mega-audit/audit-runner.ts --max-functions 10
```

## Output

Reports are generated in `.audit_results/mega-audit/`:

| File | Description |
|------|-------------|
| `audit-report.json` | Full structured report |
| `audit-report.md` | Human-readable Markdown report |
| `audit-baseline.json` | Baseline for differential audits |
| `audit-tasks.json` | Task manifest for Claude Code agents |
| `function-inventory.json` | All extracted functions (dry-run) |
| `EXECUTE.md` | Execution instructions |

## Files

| File | Purpose |
|------|---------|
| `audit-config.ts` | Domains, dimensions, severity thresholds, types |
| `audit-runner.ts` | Pipeline orchestrator |
| `audit-prompts.ts` | Dimension-specific prompt templates + few-shot examples |
| `audit-reporter.ts` | JSON + Markdown report generation |
| `audit-validators.ts` | Static validators + adversarial validation + scoring |
| `function-extractor.ts` | TypeScript AST function extraction |

## Integration with Claude Code

The audit system generates a task manifest (`audit-tasks.json`) designed for Claude Code agents:

1. Each task contains a `systemPrompt` and `userPrompt`
2. Claude Code processes tasks using the Task tool (parallelizable by domain)
3. Responses are parsed into structured findings
4. Adversarial validation filters false positives
5. Final report is generated

This enables auditing 600+ functions across 5 dimensions in a reproducible, evidence-based way.
