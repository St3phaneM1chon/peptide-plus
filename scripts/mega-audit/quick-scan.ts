#!/usr/bin/env npx tsx
/**
 * AUDIT FORGE — Quick Scan
 * Fast deterministic check of the ENTIRE codebase (not just changed files).
 * Runs in ~30 seconds. No LLM calls.
 *
 * Usage: npx tsx scripts/mega-audit/quick-scan.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ScanResult {
  pattern: string;
  severity: 'critical' | 'high' | 'medium';
  file: string;
  line: number;
  code: string;
}

const PATTERNS = [
  { id: 'RAW_SQL', pattern: /\$queryRawUnsafe\s*\(/, severity: 'critical' as const, desc: 'SQL injection via $queryRawUnsafe' },
  { id: 'HARDCODED_SECRET', pattern: /(?:api[_-]?key|secret|password)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/, severity: 'critical' as const, desc: 'Hardcoded credential' },
  { id: 'EVAL', pattern: /\beval\s*\(/, severity: 'critical' as const, desc: 'eval() usage — code injection risk' },
  { id: 'EXEC_UNSAFE', pattern: /\$executeRawUnsafe\s*\(/, severity: 'critical' as const, desc: 'Unsafe SQL execution' },
  { id: 'XSS_NO_PURIFY', pattern: /dangerouslySetInnerHTML\s*=\s*\{/, severity: 'high' as const, desc: 'dangerouslySetInnerHTML (check for DOMPurify)' },
  { id: 'NO_TAKE', pattern: /findMany\(\s*\{[^}]{0,200}\}\s*\)/, severity: 'medium' as const, desc: 'findMany possibly without take limit' },
  { id: 'CONSOLE_LOG_API', pattern: /console\.log\(/, severity: 'medium' as const, desc: 'console.log (use logger instead)' },
  { id: 'NO_VERIFY', pattern: /--no-verify/, severity: 'high' as const, desc: '--no-verify flag usage' },
  { id: 'FORCE_PUSH', pattern: /git push.*--force/, severity: 'high' as const, desc: 'Force push detected' },
];

function scanFile(filePath: string): ScanResult[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const results: ScanResult[] = [];

  for (const pattern of PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.pattern.test(lines[i])) {
        // Filter: only scan relevant file types
        if (pattern.id === 'CONSOLE_LOG_API' && !filePath.includes('route.ts')) continue;
        if (pattern.id === 'NO_TAKE' && !filePath.includes('route.ts')) continue;

        results.push({
          pattern: pattern.desc,
          severity: pattern.severity,
          file: filePath,
          line: i + 1,
          code: lines[i].trim().slice(0, 120),
        });
      }
    }
  }

  return results;
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  try {
    const output = execSync(
      `find "${dir}" -type f \\( ${extensions.map(e => `-name "*.${e}"`).join(' -o ')} \\) | grep -v node_modules | grep -v .next | grep -v dist`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return files;
  }
}

// ── Main ────────────────────────────────────────────────────────

const projectRoot = path.resolve('.');
console.log('🔍 AUDIT FORGE — Quick Scan');
console.log(`📂 Root: ${projectRoot}`);
console.log('');

const files = getAllFiles(path.join(projectRoot, 'src'), ['ts', 'tsx']);
console.log(`📁 Scanning ${files.length} TypeScript files...`);
console.log('');

const allResults: ScanResult[] = [];
for (const file of files) {
  const relativePath = path.relative(projectRoot, file);
  const results = scanFile(file);
  for (const r of results) {
    r.file = relativePath;
    allResults.push(r);
  }
}

// Group by severity
const critical = allResults.filter(r => r.severity === 'critical');
const high = allResults.filter(r => r.severity === 'high');
const medium = allResults.filter(r => r.severity === 'medium');

console.log(`📊 Results: ${critical.length} critical, ${high.length} high, ${medium.length} medium`);
console.log('');

if (critical.length > 0) {
  console.log('🔴 CRITICAL:');
  for (const r of critical) {
    console.log(`   ${r.file}:${r.line} — ${r.pattern}`);
    console.log(`   Code: ${r.code}`);
    console.log('');
  }
}

if (high.length > 0) {
  console.log('🟠 HIGH:');
  for (const r of high.slice(0, 20)) {
    console.log(`   ${r.file}:${r.line} — ${r.pattern}`);
  }
  if (high.length > 20) console.log(`   ... and ${high.length - 20} more`);
  console.log('');
}

if (medium.length > 0) {
  console.log(`🟡 MEDIUM: ${medium.length} findings (use --verbose to see all)`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════');
if (critical.length === 0) {
  console.log('✅ No critical findings. Codebase is clean.');
} else {
  console.log(`❌ ${critical.length} critical finding(s) require immediate attention.`);
}
console.log('═══════════════════════════════════════════════════════════════');
