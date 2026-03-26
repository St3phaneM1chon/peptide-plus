#!/usr/bin/env npx tsx
/**
 * PRE-PUSH DETERMINISTIC AUDIT
 * Runs in <2 minutes. NO LLM calls — only regex + AST pattern checks.
 * Blocks push if critical anti-patterns detected in staged/changed files.
 *
 * Usage: npx tsx scripts/mega-audit/pre-push-audit.ts
 * Integration: .git/hooks/pre-push calls this script
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface PatternCheck {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium';
  pattern: RegExp;
  /** Only apply to files matching this glob */
  filePattern?: RegExp;
  /** Description of why this is bad */
  reason: string;
  /** How to fix */
  fix: string;
}

const CHECKS: PatternCheck[] = [
  // CRITICAL — Block push
  {
    id: 'RAW-QUERY-INTERPOLATION',
    name: 'Raw SQL with string interpolation',
    severity: 'critical',
    pattern: /\$queryRawUnsafe\s*\(/,
    filePattern: /\.ts$/,
    reason: 'SQL injection via $queryRawUnsafe. Use $queryRaw with tagged template literals.',
    fix: 'Replace $queryRawUnsafe(...) with $queryRaw`...` (tagged template)',
  },
  {
    id: 'HARDCODED-SECRET',
    name: 'Hardcoded API key or secret',
    severity: 'critical',
    pattern: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i,
    filePattern: /\.ts$|\.tsx$/,
    reason: 'Hardcoded credential detected. Use environment variables.',
    fix: 'Move to .env and access via process.env.VAR_NAME',
  },
  {
    id: 'DANGEROUSLYSETINNERHTML-NO-SANITIZE',
    name: 'dangerouslySetInnerHTML without DOMPurify',
    severity: 'critical',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!DOMPurify)/,
    filePattern: /\.tsx$/,
    reason: 'XSS via unsanitized HTML injection.',
    fix: 'Wrap with DOMPurify.sanitize(): dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}',
  },

  // HIGH — Warn strongly
  {
    id: 'FINDMANY-NO-TAKE',
    name: 'findMany without take/limit',
    severity: 'high',
    pattern: /\.findMany\(\s*\{[^}]*\}\s*\)(?![\s\S]{0,50}take\s*:)/,
    filePattern: /route\.ts$/,
    reason: 'Unbounded query — can return millions of rows and OOM.',
    fix: 'Add take: N (e.g., take: 100) to the findMany query',
  },
  {
    id: 'TOP-LEVEL-SDK-INIT',
    name: 'Top-level SDK initialization',
    severity: 'high',
    pattern: /^(?:const|let|var)\s+\w+\s*=\s*new\s+(?:Stripe|Twilio|SendGrid|Telnyx)\(/m,
    filePattern: /\.ts$/,
    reason: 'SDK initialized at top-level crashes at build time if env var missing.',
    fix: 'Use lazy initialization pattern: function getClient() { if (!_client) _client = new X(...); return _client; }',
  },
  {
    id: 'CONSOLE-LOG-PROD',
    name: 'console.log in API route',
    severity: 'medium',
    pattern: /console\.log\(/,
    filePattern: /route\.ts$/,
    reason: 'console.log leaks to production logs. Use logger service.',
    fix: 'Replace with logger.info/warn/error from @/lib/logger',
  },

  // MEDIUM — Warn
  {
    id: 'HARDCODED-FRENCH',
    name: 'Hardcoded French string in component',
    severity: 'medium',
    pattern: /(?:return|<[a-zA-Z])[^]*?['"](?:Aucun|Chargement|Erreur|Supprimer|Modifier|Ajouter|Enregistrer|Rechercher)['"]/,
    filePattern: /page\.tsx$/,
    reason: 'Hardcoded French string — should use t() for i18n.',
    fix: 'Replace with t(\'section.key\') from useTranslations()',
  },
  {
    id: 'MISSING-ERROR-BOUNDARY',
    name: 'API route missing try/catch',
    severity: 'medium',
    pattern: /export\s+const\s+(?:POST|PUT|PATCH|DELETE)\s*=\s*withAdminGuard\(async[^]*?(?:await\s+prisma\.)(?![^]*?catch)/,
    filePattern: /route\.ts$/,
    reason: 'Unhandled Prisma error will crash the route.',
    fix: 'Wrap Prisma operations in try/catch',
  },
];

function getChangedFiles(): string[] {
  try {
    // Files changed since last push (staged + unstaged)
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  } catch {
    // Fallback: all staged files
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
      return output.trim().split('\n').filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    } catch {
      return [];
    }
  }
}

interface Finding {
  check: PatternCheck;
  file: string;
  line: number;
  match: string;
}

function auditFile(filePath: string, checks: PatternCheck[]): Finding[] {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return [];

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const findings: Finding[] = [];

  for (const check of checks) {
    if (check.filePattern && !check.filePattern.test(filePath)) continue;

    for (let i = 0; i < lines.length; i++) {
      if (check.pattern.test(lines[i])) {
        findings.push({
          check,
          file: filePath,
          line: i + 1,
          match: lines[i].trim().slice(0, 120),
        });
      }
    }
  }

  return findings;
}

// ── Main ────────────────────────────────────────────────────────

const files = getChangedFiles();
if (files.length === 0) {
  console.log('✅ No TypeScript files changed — skipping audit');
  process.exit(0);
}

console.log(`🔍 Pre-push audit: ${files.length} files`);

let criticalCount = 0;
let highCount = 0;
let mediumCount = 0;

for (const file of files) {
  const findings = auditFile(file, CHECKS);
  for (const f of findings) {
    const icon = f.check.severity === 'critical' ? '🔴' : f.check.severity === 'high' ? '🟠' : '🟡';
    console.log(`${icon} [${f.check.severity.toUpperCase()}] ${f.file}:${f.line}`);
    console.log(`   ${f.check.name}: ${f.check.reason}`);
    console.log(`   Fix: ${f.check.fix}`);
    console.log(`   Code: ${f.match}`);
    console.log('');

    if (f.check.severity === 'critical') criticalCount++;
    else if (f.check.severity === 'high') highCount++;
    else mediumCount++;
  }
}

console.log(`\n📊 Results: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium`);

if (criticalCount > 0) {
  console.log('\n❌ PUSH BLOCKED — Fix critical issues before pushing');
  process.exit(1);
}

if (highCount > 0) {
  console.log('\n⚠️  High-severity issues found — consider fixing before pushing');
}

console.log('\n✅ Pre-push audit passed');
process.exit(0);
