/**
 * INPUT-INJECTION Auditor
 * Checks for input validation, SQL injection, XSS, code injection, and path traversal risks.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class InputInjectionAuditor extends BaseAuditor {
  auditTypeCode = 'INPUT-INJECTION';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkMutationRoutesHaveZodValidation());
    results.push(...this.checkRawSqlInjection());
    results.push(...this.checkDangerouslySetInnerHTML());
    results.push(...this.checkEvalUsage());
    results.push(...this.checkPathTraversal());
    results.push(...this.checkQueryParamsInDbQueries());

    return results;
  }

  /**
   * input-01: POST/PUT/PATCH API routes must have Zod validation
   */
  private checkMutationRoutesHaveZodValidation(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiDir = path.join(this.srcDir, 'app', 'api');
    const routeFiles = this.findFiles(apiDir, /^route\.ts$/);

    if (routeFiles.length === 0) {
      results.push(this.pass('input-01', 'Zod validation check (no API routes found)'));
      return results;
    }

    const zodPatterns = [
      /z\.object\s*\(/,
      /z\.string\s*\(/,
      /z\.array\s*\(/,
      /z\.enum\s*\(/,
      /\.parse\s*\(/,
      /\.safeParse\s*\(/,
      /zodSchema/i,
      /Schema\.parse/,
      /Schema\.safeParse/,
      /validate\s*\(/,
      /zod/i,
    ];

    let unvalidatedCount = 0;
    const unvalidatedFiles: string[] = [];

    for (const file of routeFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check if route has mutation handlers (POST, PUT, PATCH)
      const hasMutation = /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH)\s*\(/.test(content);
      if (!hasMutation) continue;

      // Skip routes that don't parse a JSON body - they don't need Zod validation
      // These include: no-body endpoints (session-only), formData, raw text (webhooks), cron endpoints
      const parsesJsonBody = /request\.json\s*\(/.test(content) || /req\.json\s*\(/.test(content);
      if (!parsesJsonBody) continue;

      // Check if there is Zod (or equivalent) validation
      const hasValidation = zodPatterns.some((pattern) => pattern.test(content));

      if (!hasValidation) {
        unvalidatedCount++;
        unvalidatedFiles.push(this.relativePath(file));
        results.push(
          this.fail('input-01', 'HIGH', 'Mutation route missing input validation', `POST/PUT/PATCH handler has no Zod schema validation for request body`, {
            filePath: this.relativePath(file),
            recommendation: 'Add a Zod schema to validate request.json() before processing. Example: const data = schema.parse(await request.json())',
          })
        );
      }
    }

    if (unvalidatedCount === 0) {
      results.push(this.pass('input-01', 'All mutation API routes have input validation'));
    }

    return results;
  }

  /**
   * input-02: Check for $queryRaw / $executeRaw without Prisma.sql template tag
   */
  private checkRawSqlInjection(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.ts$/);

    let unsafeRawCount = 0;

    for (const file of tsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Find all $queryRaw and $executeRaw usages
      const rawSqlRegex = /\$(?:queryRaw|executeRaw)\s*\(/g;
      let match;

      while ((match = rawSqlRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        const snippet = this.getSnippet(content, lineNum, 3);

        // Check if the usage employs Prisma.sql tagged template or template literal tag
        // Safe patterns: $queryRaw`...` (tagged template) or $queryRaw(Prisma.sql`...`)
        const surroundingCode = content.substring(Math.max(0, match.index - 20), Math.min(content.length, match.index + 100));

        const isSafe =
          /\$(?:queryRaw|executeRaw)`/.test(surroundingCode) ||
          /Prisma\.sql/.test(surroundingCode) ||
          /Prisma\.join/.test(surroundingCode);

        if (!isSafe) {
          unsafeRawCount++;
          results.push(
            this.fail('input-02', 'CRITICAL', 'Raw SQL query without Prisma.sql template tag', `$queryRaw or $executeRaw is called without using Prisma.sql tagged template, risking SQL injection`, {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: snippet,
              recommendation: 'Use $queryRaw`SELECT ...` (tagged template) or $queryRaw(Prisma.sql`SELECT ...`) to safely parameterize queries',
            })
          );
        }
      }
    }

    if (unsafeRawCount === 0) {
      results.push(this.pass('input-02', 'No unsafe raw SQL queries detected'));
    }

    return results;
  }

  /**
   * input-03: Check for dangerouslySetInnerHTML usage
   */
  private checkDangerouslySetInnerHTML(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsxFiles = this.findFiles(this.srcDir, /\.tsx$/);

    let dangerousHtmlCount = 0;

    for (const file of tsxFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const regex = /dangerouslySetInnerHTML/g;
      let match;

      while ((match = regex.exec(content)) !== null) {
        dangerousHtmlCount++;
        const lineNum = content.substring(0, match.index).split('\n').length;
        const snippet = this.getSnippet(content, lineNum, 2);

        // Check if there is a sanitization call nearby
        const nearbyCode = content.substring(Math.max(0, match.index - 500), match.index);
        // Check for sanitization: nearby usage OR import at file level
        const hasSanitization = /DOMPurify|sanitize|sanitizeHtml|xss|purify|escape/i.test(nearbyCode) ||
          /import.*(?:DOMPurify|sanitize|sanitizeHtml|xss|purify)/i.test(content);
        // Admin-only pages rendering admin-authored HTML (CMS content, email previews)
        // are lower risk since admins are trusted content authors
        const isAdminPage = /\/admin\//.test(this.relativePath(file));
        // Breadcrumbs highlighting search terms with <mark> tags is safe (controlled HTML)
        const isBreadcrumbs = /Breadcrumbs/i.test(this.relativePath(file));

        const severity = hasSanitization ? 'LOW'
          : (isAdminPage || isBreadcrumbs) ? 'MEDIUM'
          : 'HIGH';

        results.push(
          this.fail(
            'input-03',
            severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
            'dangerouslySetInnerHTML usage detected',
            hasSanitization
              ? `dangerouslySetInnerHTML used with apparent sanitization nearby`
              : isAdminPage
              ? `dangerouslySetInnerHTML in admin page (lower risk - trusted authors) without sanitization`
              : `dangerouslySetInnerHTML used without visible sanitization, risking XSS`,
            {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: snippet,
              recommendation: hasSanitization
                ? 'Verify DOMPurify/sanitization is applied to the exact value passed to dangerouslySetInnerHTML'
                : 'Sanitize HTML with DOMPurify before using dangerouslySetInnerHTML: DOMPurify.sanitize(html)',
            }
          )
        );
      }
    }

    if (dangerousHtmlCount === 0) {
      results.push(this.pass('input-03', 'No dangerouslySetInnerHTML usage found'));
    }

    return results;
  }

  /**
   * input-04: Check for eval() or new Function() usage
   */
  private checkEvalUsage(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    let evalCount = 0;

    for (const file of tsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Skip test files, config files, and auditor files (to avoid false positives
      // from regex patterns that contain 'eval(' or 'new Function(' as search strings)
      if (file.includes('.test.') || file.includes('.spec.') || file.includes('.config.')) continue;
      if (file.includes(path.join('lib', 'auditors'))) continue;

      // Skip files with safe arithmetic parsers (custom recursive descent parser, not actual eval)
      const hasSafeParser = /safeEvalFormula|safeEval|evaluateExpression|parseArithmetic/i.test(content);

      // Check for eval() - skip occurrences in comments and safe parser contexts
      const evalRegex = /\beval\s*\(/g;
      let match;

      while ((match = evalRegex.exec(content)) !== null) {
        // Check if this eval is inside a comment
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const lineText = content.substring(lineStart, content.indexOf('\n', match.index));
        const isInComment = /^\s*\/\//.test(lineText) || /^\s*\*/.test(lineText);
        if (isInComment) continue;

        // Skip if file uses a safe arithmetic parser (documented custom parser, not real eval)
        if (hasSafeParser) continue;

        evalCount++;
        const lineNum = content.substring(0, match.index).split('\n').length;
        results.push(
          this.fail('input-04', 'CRITICAL', 'eval() usage detected', `eval() executes arbitrary code and is a major security risk`, {
            filePath: this.relativePath(file),
            lineNumber: lineNum,
            codeSnippet: this.getSnippet(content, lineNum),
            recommendation: 'Remove eval() and use structured data parsing (JSON.parse, Zod) instead',
          })
        );
      }

      // Check for new Function() - skip safe parser contexts
      const funcRegex = /new\s+Function\s*\(/g;
      while ((match = funcRegex.exec(content)) !== null) {
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const lineText = content.substring(lineStart, content.indexOf('\n', match.index));
        const isInComment = /^\s*\/\//.test(lineText) || /^\s*\*/.test(lineText);
        if (isInComment) continue;
        if (hasSafeParser) continue;

        evalCount++;
        const lineNum = content.substring(0, match.index).split('\n').length;
        results.push(
          this.fail('input-04', 'CRITICAL', 'new Function() usage detected', `new Function() is equivalent to eval() and executes arbitrary code`, {
            filePath: this.relativePath(file),
            lineNumber: lineNum,
            codeSnippet: this.getSnippet(content, lineNum),
            recommendation: 'Remove new Function() and use structured alternatives',
          })
        );
      }
    }

    if (evalCount === 0) {
      results.push(this.pass('input-04', 'No eval() or new Function() usage found'));
    }

    return results;
  }

  /**
   * input-05: Check for path.join with user-controlled input (path traversal risk)
   */
  private checkPathTraversal(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.ts$/);

    let pathTraversalRiskCount = 0;

    for (const file of tsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Look for path.join or path.resolve used with request data
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for path.join/resolve with dynamic segments from request
        const hasPathJoin = /path\.(?:join|resolve)\s*\(/.test(line);
        if (!hasPathJoin) continue;

        const hasUserInput =
          /(?:req\.query|req\.params|params\.|searchParams|request\.nextUrl|body\.)/.test(line) ||
          /(?:req\.query|req\.params|params\.|searchParams|request\.nextUrl|body\.)/.test(lines[i - 1] || '') ||
          /(?:req\.query|req\.params|params\.|searchParams|request\.nextUrl|body\.)/.test(lines[i - 2] || '');

        if (hasUserInput) {
          pathTraversalRiskCount++;
          results.push(
            this.fail('input-05', 'HIGH', 'path.join with user-controlled input', `path.join/resolve used with request parameters, risking path traversal (../../etc/passwd)`, {
              filePath: this.relativePath(file),
              lineNumber: i + 1,
              codeSnippet: this.getSnippet(content, i + 1),
              recommendation: 'Sanitize paths: strip ".." segments, use path.normalize(), validate against an allowlist, or use path.basename() for filenames',
            })
          );
        }
      }
    }

    if (pathTraversalRiskCount === 0) {
      results.push(this.pass('input-05', 'No path traversal risks detected in path.join/resolve calls'));
    }

    return results;
  }

  /**
   * input-06: Check that query parameters used in DB queries are validated
   * Looks for searchParams.get() values passed directly to Prisma without validation
   */
  private checkQueryParamsInDbQueries(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiDir = path.join(this.srcDir, 'app', 'api');
    const routeFiles = this.findFiles(apiDir, /^route\.ts$/);

    let unvalidatedQueryCount = 0;

    for (const file of routeFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check if route uses searchParams and Prisma together
      const usesSearchParams = /searchParams\.get\s*\(|url\.searchParams|request\.nextUrl\.searchParams/.test(content);
      const usesPrisma = /prisma\./.test(content);

      if (!usesSearchParams || !usesPrisma) continue;

      // Check if there is any validation between extracting params and using them
      const hasParamValidation =
        /z\./.test(content) ||
        /parseInt\s*\(/.test(content) ||
        /Number\s*\(/.test(content) ||
        /isNaN/.test(content) ||
        /\.parse\(/.test(content) ||
        /validate/.test(content) ||
        /typeof\s+/.test(content);

      // Check for direct string interpolation into Prisma where clauses
      const hasDirectUsage = /where\s*:\s*\{[^}]*searchParams/.test(content);

      if (!hasParamValidation && hasDirectUsage) {
        unvalidatedQueryCount++;
        results.push(
          this.fail('input-06', 'MEDIUM', 'Query params used in DB query without validation', `Search parameters are passed to Prisma queries without type validation or sanitization`, {
            filePath: this.relativePath(file),
            recommendation: 'Validate and type-cast all searchParams before using in database queries. Use Zod, parseInt(), or type guards.',
          })
        );
      }
    }

    if (unvalidatedQueryCount === 0) {
      results.push(this.pass('input-06', 'Query parameters appear to be validated before DB usage'));
    }

    return results;
  }
}
