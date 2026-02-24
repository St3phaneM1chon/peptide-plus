/**
 * Base class for all auditors.
 * Provides file scanning utilities used by every audit type.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AuditCheckResult, Auditor } from '@/lib/audit-engine';

export abstract class BaseAuditor implements Auditor {
  abstract auditTypeCode: string;
  abstract run(): Promise<AuditCheckResult[]>;

  protected readonly srcDir = path.join(process.cwd(), 'src');
  protected readonly rootDir = process.cwd();

  /** Recursively find files matching a pattern */
  protected findFiles(dir: string, pattern: RegExp, excludeDirs: string[] = ['node_modules', '.next']): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (excludeDirs.includes(entry.name)) continue;
        results.push(...this.findFiles(fullPath, pattern, excludeDirs));
      } else if (pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /** Read file content safely */
  protected readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      // Only log unexpected errors, not ENOENT (file not found is expected for optional files)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[BaseAuditor] Failed to read file:', filePath, error);
      }
      return '';
    }
  }

  /** Get relative path from project root */
  protected relativePath(filePath: string): string {
    return path.relative(this.rootDir, filePath);
  }

  /** Find line number of a match in content */
  protected findLineNumber(content: string, searchStr: string): number {
    const idx = content.indexOf(searchStr);
    if (idx === -1) return 0;
    return content.substring(0, idx).split('\n').length;
  }

  /** Extract code snippet around a line */
  protected getSnippet(content: string, lineNum: number, contextLines: number = 2): string {
    const lines = content.split('\n');
    const start = Math.max(0, lineNum - contextLines - 1);
    const end = Math.min(lines.length, lineNum + contextLines);
    return lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
  }

  /** Create a passed result */
  protected pass(checkId: string, title: string): AuditCheckResult {
    return { checkId, passed: true, severity: 'INFO', title, description: `${title} - OK` };
  }

  /** Create a failed result */
  protected fail(
    checkId: string,
    severity: AuditCheckResult['severity'],
    title: string,
    description: string,
    opts?: { filePath?: string; lineNumber?: number; codeSnippet?: string; recommendation?: string }
  ): AuditCheckResult {
    return {
      checkId,
      passed: false,
      severity,
      title,
      description,
      ...opts,
    };
  }

  /** Find all API route files */
  protected findApiRoutes(): string[] {
    return this.findFiles(path.join(this.srcDir, 'app', 'api'), /^route\.ts$/);
  }

  /** Find all page files */
  protected findPages(): string[] {
    return this.findFiles(path.join(this.srcDir, 'app'), /^page\.tsx$/);
  }

  /** Find all component files */
  protected findComponents(): string[] {
    return this.findFiles(path.join(this.srcDir, 'components'), /\.tsx$/);
  }

  /** Find all lib files */
  protected findLibFiles(): string[] {
    return this.findFiles(path.join(this.srcDir, 'lib'), /\.ts$/);
  }
}

export default BaseAuditor;
