/**
 * AUDIT REPORTER
 * Generates consolidated reports in JSON and Markdown formats.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  AuditReport,
  AuditFinding,
  AuditDimension,
  FunctionAuditResult,
  Severity,
  Grade,
} from './audit-config';
import { DIMENSIONS, OUTPUT_DIR, REPORT_JSON, REPORT_MD, BASELINE_FILE, scoreToGrade } from './audit-config';
import type { StaticValidationResult } from './audit-validators';

// =====================================================
// REPORT BUILDER
// =====================================================

export function buildReport(
  projectRoot: string,
  functions: FunctionAuditResult[],
  gitCommit?: string,
): AuditReport {
  const allFindings: AuditFinding[] = [];
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byDimensionFindings: Record<AuditDimension, AuditFinding[]> = {
    security: [], performance: [], reliability: [], maintainability: [], compliance: [],
  };
  const byDomainData: Record<string, { findings: AuditFinding[]; functions: number }> = {};

  for (const func of functions) {
    const domain = func.domain;
    if (!byDomainData[domain]) {
      byDomainData[domain] = { findings: [], functions: 0 };
    }
    byDomainData[domain].functions++;

    for (const dim of DIMENSIONS) {
      const dimResult = func.dimensions[dim];
      for (const finding of dimResult.findings) {
        allFindings.push({ ...finding, file: func.file });
        bySeverity[finding.severity]++;
        byDimensionFindings[dim].push(finding);
        byDomainData[domain].findings.push(finding);
      }
    }
  }

  const byDimension: Record<AuditDimension, { grade: Grade; findingsCount: number }> = {} as Record<AuditDimension, { grade: Grade; findingsCount: number }>;
  for (const dim of DIMENSIONS) {
    const dimFindings = byDimensionFindings[dim];
    const weightedScore = dimFindings.reduce((sum, f) => {
      const weights: Record<Severity, number> = { critical: 10, high: 5, medium: 2, low: 1, info: 0 };
      return sum + weights[f.severity] * f.confidence;
    }, 0);
    byDimension[dim] = {
      grade: scoreToGrade(weightedScore / Math.max(functions.length, 1)),
      findingsCount: dimFindings.length,
    };
  }

  const byDomain: Record<string, { grade: Grade; functionsAudited: number; findingsCount: number }> = {};
  for (const [domain, data] of Object.entries(byDomainData)) {
    const weightedScore = data.findings.reduce((sum, f) => {
      const weights: Record<Severity, number> = { critical: 10, high: 5, medium: 2, low: 1, info: 0 };
      return sum + weights[f.severity] * f.confidence;
    }, 0);
    byDomain[domain] = {
      grade: scoreToGrade(weightedScore / Math.max(data.functions, 1)),
      functionsAudited: data.functions,
      findingsCount: data.findings.length,
    };
  }

  // Top critical findings (sorted by severity then confidence)
  const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const topCritical = allFindings
    .filter(f => f.severity === 'critical' || f.severity === 'high')
    .sort((a, b) => {
      const diff = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      return diff !== 0 ? diff : b.confidence - a.confidence;
    })
    .slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    projectRoot,
    gitCommit,
    totalFunctions: functions.length,
    totalFindings: allFindings.length,
    bySeverity,
    byDimension,
    byDomain,
    functions,
    topCritical,
  };
}

// =====================================================
// JSON OUTPUT
// =====================================================

export function writeJsonReport(projectRoot: string, report: AuditReport): string {
  const outputDir = path.join(projectRoot, OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const filePath = path.join(outputDir, REPORT_JSON);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  console.log(`[reporter] JSON report written: ${filePath}`);
  return filePath;
}

export function writeBaseline(projectRoot: string, functions: FunctionAuditResult[]): string {
  const outputDir = path.join(projectRoot, OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const filePath = path.join(outputDir, BASELINE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(functions, null, 2));
  console.log(`[reporter] Baseline written: ${filePath}`);
  return filePath;
}

// =====================================================
// MARKDOWN OUTPUT
// =====================================================

function gradeEmoji(grade: Grade): string {
  switch (grade) {
    case 'A': return 'A';
    case 'B': return 'B';
    case 'C': return 'C';
    case 'D': return 'D';
    case 'F': return 'F';
  }
}

function severityBadge(severity: Severity): string {
  switch (severity) {
    case 'critical': return '**CRITICAL**';
    case 'high': return '**HIGH**';
    case 'medium': return 'MEDIUM';
    case 'low': return 'low';
    case 'info': return 'info';
  }
}

export function writeMarkdownReport(
  projectRoot: string,
  report: AuditReport,
  staticResults?: StaticValidationResult[],
): string {
  const outputDir = path.join(projectRoot, OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const lines: string[] = [];

  // Header
  lines.push('# Mega-Audit Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  if (report.gitCommit) lines.push(`Git Commit: \`${report.gitCommit}\``);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Functions audited | ${report.totalFunctions} |`);
  lines.push(`| Total findings | ${report.totalFindings} |`);
  lines.push(`| Critical | ${report.bySeverity.critical} |`);
  lines.push(`| High | ${report.bySeverity.high} |`);
  lines.push(`| Medium | ${report.bySeverity.medium} |`);
  lines.push(`| Low | ${report.bySeverity.low} |`);
  lines.push(`| Info | ${report.bySeverity.info} |`);
  lines.push('');

  // Static validation results
  if (staticResults) {
    lines.push('## Static Validation (Layer 1)');
    lines.push('');
    lines.push('| Tool | Status | Errors | Warnings | Details |');
    lines.push('|------|--------|--------|----------|---------|');
    for (const r of staticResults) {
      lines.push(`| ${r.tool} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.errors} | ${r.warnings} | ${r.details.slice(0, 80)} |`);
    }
    lines.push('');
  }

  // Dimension scores
  lines.push('## Scores by Dimension');
  lines.push('');
  lines.push('| Dimension | Grade | Findings |');
  lines.push('|-----------|-------|----------|');
  for (const dim of DIMENSIONS) {
    const d = report.byDimension[dim];
    lines.push(`| ${dim} | ${gradeEmoji(d.grade)} | ${d.findingsCount} |`);
  }
  lines.push('');

  // Domain scores
  lines.push('## Scores by Domain');
  lines.push('');
  lines.push('| Domain | Grade | Functions | Findings |');
  lines.push('|--------|-------|-----------|----------|');
  for (const [domain, d] of Object.entries(report.byDomain)) {
    lines.push(`| ${domain} | ${gradeEmoji(d.grade)} | ${d.functionsAudited} | ${d.findingsCount} |`);
  }
  lines.push('');

  // Top critical findings
  if (report.topCritical.length > 0) {
    lines.push('## Top Critical & High Findings');
    lines.push('');
    for (const f of report.topCritical) {
      lines.push(`### ${severityBadge(f.severity)} ${f.title}`);
      lines.push('');
      lines.push(`- **ID**: ${f.id}`);
      lines.push(`- **File**: \`${f.file}\` line ${f.line}`);
      lines.push(`- **Dimension**: ${f.dimension}`);
      lines.push(`- **Confidence**: ${(f.confidence * 100).toFixed(0)}%`);
      if (f.cweId) lines.push(`- **CWE**: ${f.cweId}`);
      if (f.owaspCategory) lines.push(`- **OWASP**: ${f.owaspCategory}`);
      lines.push('');
      lines.push(f.description);
      lines.push('');
      if (f.codeSnippet) {
        lines.push('```typescript');
        lines.push(`// Vulnerable code (line ${f.line}):`);
        lines.push(f.codeSnippet);
        lines.push('```');
        lines.push('');
      }
      if (f.suggestedFix) {
        lines.push('**Suggested fix:**');
        lines.push('```typescript');
        lines.push(f.suggestedFix);
        lines.push('```');
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }
  }

  // Per-function details (summary table)
  lines.push('## All Functions');
  lines.push('');
  lines.push('| Function | File | Domain | Overall | Sec | Perf | Rel | Maint | Comp | Findings |');
  lines.push('|----------|------|--------|---------|-----|------|-----|-------|------|----------|');
  for (const func of report.functions) {
    const totalFindings = func.criticalFindings + func.highFindings + func.mediumFindings + func.lowFindings;
    lines.push(
      `| ${func.function} | ${func.file.replace(projectRoot + '/', '')} | ${func.domain} ` +
      `| ${func.overallScore} | ${func.dimensions.security.score} | ${func.dimensions.performance.score} ` +
      `| ${func.dimensions.reliability.score} | ${func.dimensions.maintainability.score} ` +
      `| ${func.dimensions.compliance.score} | ${totalFindings} |`
    );
  }
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Generated by peptide-plus mega-audit system*');

  const content = lines.join('\n');
  const filePath = path.join(outputDir, REPORT_MD);
  fs.writeFileSync(filePath, content);
  console.log(`[reporter] Markdown report written: ${filePath}`);
  return filePath;
}
