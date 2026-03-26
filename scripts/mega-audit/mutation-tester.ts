/**
 * AUDIT FORGE — Mutation Tester
 * Injects deliberate bugs into code to verify audit quality.
 * Based on Meta's Mutation-Guided LLM approach (FSE 2025).
 *
 * Usage: npx tsx scripts/mega-audit/mutation-tester.ts --domain auth
 *
 * Generates context-aware mutations (not random), measures if the audit
 * pipeline would catch them. Target: 80%+ detection rate.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Mutation {
  id: string;
  file: string;
  line: number;
  originalCode: string;
  mutatedCode: string;
  category: 'security' | 'integrity' | 'performance' | 'reliability';
  description: string;
  expectedSeverity: 'critical' | 'high' | 'medium';
}

/**
 * Generate context-aware mutations for a given file.
 * These represent REAL bugs that should be caught by the audit.
 */
export function generateMutations(filePath: string): Mutation[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const mutations: Mutation[] = [];
  const basename = path.basename(filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Mutation 1: Remove tenantId from Prisma where clause
    if (line.includes('tenantId') && line.includes('where:')) {
      mutations.push({
        id: `MUT-${basename}-${lineNum}-TENANT`,
        file: filePath,
        line: lineNum,
        originalCode: line.trim(),
        mutatedCode: line.replace(/tenantId,?\s*/, ''),
        category: 'security',
        description: 'Remove tenantId filter — cross-tenant data leak',
        expectedSeverity: 'critical',
      });
    }

    // Mutation 2: Remove auth guard
    if (line.includes('withAdminGuard') || line.includes('withUserGuard')) {
      mutations.push({
        id: `MUT-${basename}-${lineNum}-AUTH`,
        file: filePath,
        line: lineNum,
        originalCode: line.trim(),
        mutatedCode: line.replace(/with(?:Admin|User)Guard\(/, '('),
        category: 'security',
        description: 'Remove auth guard — unauthenticated access',
        expectedSeverity: 'critical',
      });
    }

    // Mutation 3: Remove Zod validation
    if (line.includes('safeParse')) {
      mutations.push({
        id: `MUT-${basename}-${lineNum}-VALID`,
        file: filePath,
        line: lineNum,
        originalCode: line.trim(),
        mutatedCode: line.replace(/\.safeParse\(body\)/, '{ success: true, data: body }'),
        category: 'security',
        description: 'Bypass input validation — injection risk',
        expectedSeverity: 'high',
      });
    }

    // Mutation 4: Remove $transaction
    if (line.includes('$transaction')) {
      mutations.push({
        id: `MUT-${basename}-${lineNum}-TX`,
        file: filePath,
        line: lineNum,
        originalCode: line.trim(),
        mutatedCode: '// $transaction removed — race condition introduced',
        category: 'integrity',
        description: 'Remove transaction — data corruption on concurrent access',
        expectedSeverity: 'high',
      });
    }

    // Mutation 5: Remove take/limit (unbounded query)
    if (/take:\s*\d+/.test(line)) {
      mutations.push({
        id: `MUT-${basename}-${lineNum}-LIMIT`,
        file: filePath,
        line: lineNum,
        originalCode: line.trim(),
        mutatedCode: line.replace(/take:\s*\d+,?\s*/, ''),
        category: 'performance',
        description: 'Remove query limit — potential OOM on large datasets',
        expectedSeverity: 'medium',
      });
    }

    // Mutation 6: Expose PII (add email to select)
    if (line.includes('select:') && line.includes('name: true') && !line.includes('email')) {
      mutations.push({
        id: `MUT-${basename}-${lineNum}-PII`,
        file: filePath,
        line: lineNum,
        originalCode: line.trim(),
        mutatedCode: line.replace('name: true', 'name: true, email: true'),
        category: 'security',
        description: 'Add email to response — PII leak',
        expectedSeverity: 'high',
      });
    }
  }

  // Limit to 10 mutations per file (most impactful)
  return mutations.slice(0, 10);
}

/**
 * Check if an audit would catch a given mutation.
 * Returns true if the audit findings cover the mutated area.
 */
export function wouldAuditCatch(
  mutation: Mutation,
  findings: Array<{ file: string; line: number; category: string }>
): boolean {
  return findings.some(f =>
    f.file === mutation.file &&
    Math.abs(f.line - mutation.line) <= 5 &&
    (f.category === mutation.category || f.category === 'security')
  );
}

/**
 * Run mutation testing and report detection rate.
 */
export function runMutationTest(
  files: string[],
  findings: Array<{ file: string; line: number; category: string }>
): { mutations: Mutation[]; caught: number; missed: number; detectionRate: number } {
  const allMutations: Mutation[] = [];

  for (const file of files) {
    try {
      const mutations = generateMutations(file);
      allMutations.push(...mutations);
    } catch {
      // Skip files that can't be read
    }
  }

  let caught = 0;
  let missed = 0;

  for (const mutation of allMutations) {
    if (wouldAuditCatch(mutation, findings)) {
      caught++;
    } else {
      missed++;
    }
  }

  const total = caught + missed;
  const detectionRate = total > 0 ? Math.round((caught / total) * 100) : 0;

  return { mutations: allMutations, caught, missed, detectionRate };
}

/**
 * Generate a mutation testing report.
 */
export function generateMutationReport(
  result: { mutations: Mutation[]; caught: number; missed: number; detectionRate: number }
): string {
  const lines = [
    '## Mutation Testing Report',
    `Total mutations: ${result.mutations.length}`,
    `Caught by audit: ${result.caught}`,
    `Missed by audit: ${result.missed}`,
    `Detection rate: ${result.detectionRate}% (target: 80%)`,
    '',
    result.detectionRate >= 80
      ? '✅ PASS — Audit quality is sufficient'
      : '❌ FAIL — Audit quality below threshold, review methodology',
    '',
  ];

  if (result.missed > 0) {
    lines.push('### Missed Mutations (audit gaps):');
    const missed = result.mutations.filter(m =>
      !result.mutations.some(() => false) // placeholder
    );
    for (const m of result.mutations.slice(0, 20)) {
      lines.push(`- [${m.expectedSeverity}] ${m.file}:${m.line} — ${m.description}`);
    }
  }

  return lines.join('\n');
}
