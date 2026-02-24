/**
 * TYPESCRIPT-QUALITY Auditor
 * Checks TypeScript code quality: any usage, strict config, catch typing, type assertions.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class TypescriptQualityAuditor extends BaseAuditor {
  auditTypeCode = 'TYPESCRIPT-QUALITY';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkAnyTypeUsage());
    results.push(...this.checkStrictMode());
    results.push(...this.checkCatchBlockTyping());
    results.push(...this.checkTypeAssertions());

    return results;
  }

  /**
   * ts-01: Count `any` type usage across all .ts/.tsx files.
   * Reports files with more than 5 occurrences of `any`.
   */
  private checkAnyTypeUsage(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    // Match `: any`, `as any`, `<any>`, generic `any` in type positions
    // Avoid matching words like "many", "company", "any-" in comments/strings
    const anyPattern = /(?::|\bas\b|<|,)\s*any(?:\s*[>;,)\]|&}]|\s*$)/gm;

    const offenders: { file: string; count: number; lines: number[] }[] = [];
    let totalAnyCount = 0;

    for (const file of tsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');
      const fileMatches: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment-only lines
        if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

        const matches = line.match(anyPattern);
        if (matches) {
          fileMatches.push(i + 1);
        }
      }

      if (fileMatches.length > 0) {
        totalAnyCount += fileMatches.length;
        if (fileMatches.length > 5) {
          offenders.push({ file, count: fileMatches.length, lines: fileMatches.slice(0, 10) });
        }
      }
    }

    if (offenders.length === 0) {
      results.push(
        this.pass('ts-01', `No files with excessive \`any\` usage (>5 per file). Total across codebase: ${totalAnyCount}`)
      );
    } else {
      for (const offender of offenders) {
        const content = this.readFile(offender.file);
        const firstLine = offender.lines[0];
        results.push(
          this.fail(
            'ts-01',
            'MEDIUM',
            'Excessive `any` type usage',
            `File has ${offender.count} \`any\` type usages (threshold: 5). Lines: ${offender.lines.join(', ')}`,
            {
              filePath: this.relativePath(offender.file),
              lineNumber: firstLine,
              codeSnippet: content ? this.getSnippet(content, firstLine) : undefined,
              recommendation:
                'Replace `any` with proper types. Use `unknown` for truly unknown types, or define interfaces for expected shapes.',
            }
          )
        );
      }

      results.push(
        this.fail(
          'ts-01',
          'INFO',
          '`any` usage summary',
          `Total: ${totalAnyCount} \`any\` usages across codebase. ${offenders.length} file(s) exceed the 5-per-file threshold.`,
          {
            recommendation:
              'Gradually eliminate `any` types. Prioritize files with the highest counts first.',
          }
        )
      );
    }

    return results;
  }

  /**
   * ts-02: Check tsconfig.json has strict: true
   */
  private checkStrictMode(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsconfigPath = path.join(this.rootDir, 'tsconfig.json');
    const content = this.readFile(tsconfigPath);

    if (!content) {
      results.push(
        this.fail('ts-02', 'HIGH', 'tsconfig.json not found', 'No tsconfig.json found at project root', {
          recommendation: 'Create a tsconfig.json with strict: true enabled',
        })
      );
      return results;
    }

    // Parse removing comments while respecting string literals
    // Simple approach: strip line-by-line, skipping content inside quotes
    const stripped = content
      .split('\n')
      .map(line => {
        let inString = false;
        let stringChar = '';
        let result = '';
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inString) {
            result += ch;
            if (ch === '\\') { result += line[++i] || ''; continue; }
            if (ch === stringChar) inString = false;
          } else {
            if (ch === '"' || ch === "'") { inString = true; stringChar = ch; result += ch; }
            else if (ch === '/' && line[i + 1] === '/') break; // line comment
            else if (ch === '/' && line[i + 1] === '*') {
              // Block comment - skip until */
              const end = line.indexOf('*/', i + 2);
              if (end >= 0) { i = end + 1; } else { break; }
            }
            else { result += ch; }
          }
        }
        return result;
      })
      .join('\n');

    try {
      const tsconfig = JSON.parse(stripped);
      const compilerOptions = tsconfig.compilerOptions || {};

      if (compilerOptions.strict === true) {
        results.push(this.pass('ts-02', 'tsconfig.json has strict: true'));
      } else {
        results.push(
          this.fail(
            'ts-02',
            'HIGH',
            'TypeScript strict mode not enabled',
            `tsconfig.json has strict: ${compilerOptions.strict ?? 'not set'}. Strict mode catches many type errors at compile time.`,
            {
              filePath: this.relativePath(tsconfigPath),
              lineNumber: this.findLineNumber(content, '"strict"'),
              recommendation: 'Set "strict": true in compilerOptions to enable all strict type-checking options',
            }
          )
        );
      }

      // Also check noUncheckedIndexedAccess for extra strictness
      if (compilerOptions.noUncheckedIndexedAccess === true) {
        results.push(this.pass('ts-02', 'noUncheckedIndexedAccess is enabled (bonus)'));
      }
    } catch (error) {
      console.error('[TypescriptQuality] Failed to parse tsconfig.json:', error);
      results.push(
        this.fail('ts-02', 'MEDIUM', 'Could not parse tsconfig.json', 'tsconfig.json contains invalid JSON', {
          filePath: this.relativePath(tsconfigPath),
          recommendation: 'Fix the JSON syntax in tsconfig.json',
        })
      );
    }

    return results;
  }

  /**
   * ts-03: Check catch blocks for proper error typing.
   * Flags catch(e: any) and catch(e) without explicit typing.
   */
  private checkCatchBlockTyping(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    // Patterns for problematic catch blocks
    const catchAnyPattern = /catch\s*\(\s*\w+\s*:\s*any\s*\)/g;
    const catchUntypedPattern = /catch\s*\(\s*(\w+)\s*\)/g;

    const issues: { file: string; line: number; type: 'any' | 'untyped'; snippet: string }[] = [];

    for (const file of tsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (catchAnyPattern.test(line)) {
          issues.push({
            file,
            line: i + 1,
            type: 'any',
            snippet: this.getSnippet(content, i + 1),
          });
        }
        catchAnyPattern.lastIndex = 0;

        // Check for untyped catch - but only if it doesn't use `: unknown` or `: Error`
        const untypedMatch = catchUntypedPattern.exec(line);
        if (untypedMatch && !/:\s*(unknown|Error|TypeError|SyntaxError)/.test(line)) {
          // Verify this is not catch(e: unknown) or catch(e: Error) etc
          if (!/catch\s*\(\s*\w+\s*:/.test(line)) {
            issues.push({
              file,
              line: i + 1,
              type: 'untyped',
              snippet: this.getSnippet(content, i + 1),
            });
          }
        }
        catchUntypedPattern.lastIndex = 0;
      }
    }

    if (issues.length === 0) {
      results.push(this.pass('ts-03', 'All catch blocks use proper error typing'));
    } else {
      const anyIssues = issues.filter((i) => i.type === 'any');
      const untypedIssues = issues.filter((i) => i.type === 'untyped');

      // Report up to 10 worst offenders
      const reportItems = issues.slice(0, 10);
      for (const item of reportItems) {
        results.push(
          this.fail(
            'ts-03',
            item.type === 'any' ? 'MEDIUM' : 'LOW',
            item.type === 'any' ? 'Catch block uses `any` error type' : 'Catch block has untyped error parameter',
            item.type === 'any'
              ? 'Using `catch(e: any)` bypasses type safety. Use `catch(e: unknown)` and narrow the type.'
              : 'Catch parameter has no explicit type. Use `catch(e: unknown)` for type safety.',
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              codeSnippet: item.snippet,
              recommendation:
                'Use `catch(error: unknown)` and narrow with `if (error instanceof Error)` before accessing .message',
            }
          )
        );
      }

      if (issues.length > 10) {
        results.push(
          this.fail(
            'ts-03',
            'INFO',
            'Catch typing summary',
            `Total: ${issues.length} catch blocks need fixing (${anyIssues.length} with \`any\`, ${untypedIssues.length} untyped). Showing first 10.`,
            {
              recommendation: 'Run a codemod to replace all catch(e) with catch(e: unknown)',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * ts-04: Count `as ` type assertions, flag those without nearby comments.
   * Type assertions bypass the type checker and should be documented.
   */
  private checkTypeAssertions(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    // Pattern to match type assertions: `as SomeType` (not `as const`)
    const assertionPattern = /\bas\s+(?!const\b)([A-Z]\w+(?:<[^>]+>)?|\{[^}]+\})/g;

    const undocumentedAssertions: { file: string; line: number; assertion: string }[] = [];
    let totalAssertions = 0;

    for (const file of tsFiles) {
      const rel = this.relativePath(file);
      // Skip test files - type assertions in tests are expected (mocks, fixtures, test data)
      if (/__tests__|\.test\.|\.spec\.|test\/|tests\//i.test(rel)) continue;

      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comment lines
        if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

        let match;
        while ((match = assertionPattern.exec(line)) !== null) {
          totalAssertions++;

          // Check if there's a comment on same line or the line above
          const hasCommentSameLine = /\/\/.*$/.test(line.slice(match.index));
          const hasCommentAbove = i > 0 && /^\s*\/\//.test(lines[i - 1]);

          if (!hasCommentSameLine && !hasCommentAbove) {
            undocumentedAssertions.push({
              file,
              line: i + 1,
              assertion: match[0].trim(),
            });
          }
        }
        assertionPattern.lastIndex = 0;
      }
    }

    if (undocumentedAssertions.length === 0) {
      results.push(
        this.pass('ts-04', `All ${totalAssertions} type assertions are documented with comments`)
      );
    } else {
      // Report summary
      results.push(
        this.fail(
          'ts-04',
          'LOW',
          'Undocumented type assertions found',
          `${undocumentedAssertions.length} of ${totalAssertions} type assertions lack explanatory comments`,
          {
            recommendation:
              'Add a comment explaining why the type assertion is needed (e.g., // Safe: validated by zod schema above)',
          }
        )
      );

      // Report up to 8 specific instances
      const reportItems = undocumentedAssertions.slice(0, 8);
      for (const item of reportItems) {
        const content = this.readFile(item.file);
        results.push(
          this.fail(
            'ts-04',
            'LOW',
            'Type assertion without comment',
            `\`${item.assertion}\` used without explanatory comment`,
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              codeSnippet: content ? this.getSnippet(content, item.line) : undefined,
              recommendation:
                'Add a comment on the same line or line above explaining why this assertion is safe',
            }
          )
        );
      }
    }

    return results;
  }
}
