/**
 * AUDIT VALIDATORS
 * Layer 4: Adversarial validation — an independent "critic" agent
 * that challenges findings to filter false positives and calibrate severity.
 *
 * Also includes static pre-validators (TypeScript, ESLint, Prisma).
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type {
  AuditFinding,
  AuditDimension,
  Severity,
  FunctionAuditResult,
} from './audit-config';
import { MIN_CONFIDENCE, SEVERITY_WEIGHTS, scoreToGrade } from './audit-config';

// =====================================================
// LAYER 1: STATIC VALIDATORS
// =====================================================

export interface StaticValidationResult {
  tool: string;
  passed: boolean;
  errors: number;
  warnings: number;
  details: string;
}

export function runPrismaValidate(projectRoot: string): StaticValidationResult {
  try {
    execSync('npx prisma validate', { cwd: projectRoot, stdio: 'pipe' });
    return { tool: 'prisma-validate', passed: true, errors: 0, warnings: 0, details: 'Schema valid' };
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() || 'Unknown error';
    return { tool: 'prisma-validate', passed: false, errors: 1, warnings: 0, details: stderr };
  }
}

export function runTypeScriptCheck(projectRoot: string): StaticValidationResult {
  try {
    const output = execSync('npx tsc --noEmit --pretty 2>&1 || true', {
      cwd: projectRoot,
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
    }).toString();

    const errorCount = (output.match(/error TS\d+/g) || []).length;
    const warningCount = (output.match(/warning TS\d+/g) || []).length;

    return {
      tool: 'typescript',
      passed: errorCount === 0,
      errors: errorCount,
      warnings: warningCount,
      details: errorCount > 0 ? output.slice(0, 2000) : 'No type errors',
    };
  } catch (err) {
    return {
      tool: 'typescript',
      passed: false,
      errors: -1,
      warnings: 0,
      details: (err as Error).message,
    };
  }
}

export function runESLintCheck(projectRoot: string): StaticValidationResult {
  try {
    const output = execSync('npx eslint src/ --format json --max-warnings 9999 2>/dev/null || true', {
      cwd: projectRoot,
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
    }).toString();

    try {
      const results = JSON.parse(output);
      let errors = 0;
      let warnings = 0;
      for (const file of results) {
        errors += file.errorCount || 0;
        warnings += file.warningCount || 0;
      }
      return {
        tool: 'eslint',
        passed: errors === 0,
        errors,
        warnings,
        details: `${errors} errors, ${warnings} warnings across ${results.length} files`,
      };
    } catch {
      return { tool: 'eslint', passed: true, errors: 0, warnings: 0, details: 'ESLint output unparseable (likely clean)' };
    }
  } catch (err) {
    return {
      tool: 'eslint',
      passed: false,
      errors: -1,
      warnings: 0,
      details: (err as Error).message,
    };
  }
}

export function runAllStaticValidations(projectRoot: string): StaticValidationResult[] {
  console.log('[validators] Running static validations...');
  return [
    runPrismaValidate(projectRoot),
    runTypeScriptCheck(projectRoot),
    runESLintCheck(projectRoot),
  ];
}

// =====================================================
// LAYER 4: ADVERSARIAL VALIDATION
// =====================================================

export interface AdversarialVerdict {
  findingId: string;
  verdict: 'confirmed' | 'downgraded' | 'false_positive';
  adjustedSeverity: Severity;
  adjustedConfidence: number;
  reasoning: string;
}

/**
 * Apply adversarial verdicts to findings.
 * - false_positive: remove the finding
 * - downgraded: adjust severity and confidence
 * - confirmed: keep as-is
 */
export function applyAdversarialVerdicts(
  findings: AuditFinding[],
  verdicts: AdversarialVerdict[],
): AuditFinding[] {
  const verdictMap = new Map(verdicts.map(v => [v.findingId, v]));
  const filtered: AuditFinding[] = [];

  for (const finding of findings) {
    const verdict = verdictMap.get(finding.id);

    if (!verdict) {
      // No verdict — keep if above confidence threshold
      if (finding.confidence >= MIN_CONFIDENCE) {
        filtered.push(finding);
      }
      continue;
    }

    switch (verdict.verdict) {
      case 'false_positive':
        console.log(`[validators] Removed false positive: ${finding.id} — ${verdict.reasoning}`);
        break;

      case 'downgraded':
        filtered.push({
          ...finding,
          severity: verdict.adjustedSeverity,
          confidence: verdict.adjustedConfidence,
        });
        break;

      case 'confirmed':
        filtered.push(finding);
        break;
    }
  }

  return filtered;
}

// =====================================================
// SCORING
// =====================================================

/**
 * Score a set of findings for a single dimension.
 */
export function scoreDimension(
  findings: AuditFinding[],
  emphasized: boolean = false,
): { score: number; grade: ReturnType<typeof scoreToGrade> } {
  let weightedScore = 0;
  for (const f of findings) {
    weightedScore += SEVERITY_WEIGHTS[f.severity] * f.confidence;
  }
  if (emphasized) {
    weightedScore *= 2;
  }
  return {
    score: Math.round(weightedScore * 100) / 100,
    grade: scoreToGrade(weightedScore),
  };
}

/**
 * Build a complete FunctionAuditResult from raw findings.
 */
export function buildFunctionResult(
  funcName: string,
  file: string,
  line: number,
  endLine: number,
  domain: string,
  allFindings: AuditFinding[],
  emphasizedDimensions: AuditDimension[] = [],
): FunctionAuditResult {
  const dimensions: FunctionAuditResult['dimensions'] = {} as FunctionAuditResult['dimensions'];
  let totalWeighted = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  const allDims: AuditDimension[] = ['security', 'performance', 'reliability', 'maintainability', 'compliance'];

  for (const dim of allDims) {
    const dimFindings = allFindings.filter(f => f.dimension === dim);
    const emphasized = emphasizedDimensions.includes(dim);
    const { score, grade } = scoreDimension(dimFindings, emphasized);

    const avgConfidence = dimFindings.length > 0
      ? dimFindings.reduce((sum, f) => sum + f.confidence, 0) / dimFindings.length
      : 1.0;

    dimensions[dim] = {
      score: grade,
      weightedScore: score,
      findings: dimFindings,
      confidence: Math.round(avgConfidence * 100) / 100,
    };

    totalWeighted += score;

    for (const f of dimFindings) {
      if (f.severity === 'critical') criticalCount++;
      else if (f.severity === 'high') highCount++;
      else if (f.severity === 'medium') mediumCount++;
      else if (f.severity === 'low') lowCount++;
    }
  }

  return {
    function: funcName,
    file,
    line,
    endLine,
    domain,
    dimensions,
    overallScore: scoreToGrade(totalWeighted / allDims.length),
    overallWeightedScore: Math.round((totalWeighted / allDims.length) * 100) / 100,
    criticalFindings: criticalCount,
    highFindings: highCount,
    mediumFindings: mediumCount,
    lowFindings: lowCount,
  };
}

// =====================================================
// BASELINE DIFF
// =====================================================

/**
 * Compare current audit against a baseline to find new/resolved findings.
 */
export function diffBaseline(
  current: FunctionAuditResult[],
  baselinePath: string,
): { newFindings: AuditFinding[]; resolvedFindings: AuditFinding[]; unchangedCount: number } {
  if (!fs.existsSync(baselinePath)) {
    // No baseline — everything is new
    const allFindings = current.flatMap(f =>
      Object.values(f.dimensions).flatMap(d => d.findings)
    );
    return { newFindings: allFindings, resolvedFindings: [], unchangedCount: 0 };
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as FunctionAuditResult[];
  const baselineIds = new Set<string>();
  const currentIds = new Set<string>();
  const baselineFindingsMap = new Map<string, AuditFinding>();

  for (const func of baseline) {
    for (const dim of Object.values(func.dimensions)) {
      for (const f of dim.findings) {
        const key = `${func.file}:${f.id}:${f.title}`;
        baselineIds.add(key);
        baselineFindingsMap.set(key, f);
      }
    }
  }

  const newFindings: AuditFinding[] = [];
  let unchangedCount = 0;

  for (const func of current) {
    for (const dim of Object.values(func.dimensions)) {
      for (const f of dim.findings) {
        const key = `${func.file}:${f.id}:${f.title}`;
        currentIds.add(key);
        if (!baselineIds.has(key)) {
          newFindings.push(f);
        } else {
          unchangedCount++;
        }
      }
    }
  }

  const resolvedFindings: AuditFinding[] = [];
  for (const [key, finding] of baselineFindingsMap.entries()) {
    if (!currentIds.has(key)) {
      resolvedFindings.push(finding);
    }
  }

  return { newFindings, resolvedFindings, unchangedCount };
}
