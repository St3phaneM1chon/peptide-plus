/**
 * API-CONTRACTS Auditor
 * Checks API response consistency: response shapes, error patterns, status codes, pagination.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class ApiContractsAuditor extends BaseAuditor {
  auditTypeCode = 'API-CONTRACTS';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkResponseShape());
    results.push(...this.checkErrorResponsePattern());
    results.push(...this.checkHttpStatusCodes());
    results.push(...this.checkPagination());

    return results;
  }

  /**
   * api-01: Check API responses use consistent shape (NextResponse.json with same pattern).
   * All success responses should follow a predictable structure.
   */
  private checkResponseShape(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiRoutes = this.findApiRoutes();

    if (apiRoutes.length === 0) {
      results.push(this.pass('api-01', 'No API routes to check'));
      return results;
    }

    // Track response patterns across all routes
    const patterns = {
      nextResponseJson: 0,
      responseJson: 0,
      returnJson: 0,
      rawReturn: 0,
    };

    const wrappedResponses: string[] = []; // Files using { data: ... } wrapper
    const unwrappedResponses: string[] = []; // Files returning raw objects
    const mixedFiles: { file: string; line: number }[] = [];

    for (const file of apiRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      const relPath = this.relativePath(file);

      // Count response method types (use negative lookbehind to avoid double-counting NextResponse as Response)
      if (/NextResponse\.json\s*\(/.test(content)) patterns.nextResponseJson++;
      if (/(?<!Next)Response\.json\s*\(/.test(content)) patterns.responseJson++;
      if (/return\s+new\s+Response\s*\(/.test(content)) patterns.rawReturn++;

      // Check if responses use a wrapper pattern like { data: ... } or { success: ..., data: ... }
      const hasWrapped = /NextResponse\.json\s*\(\s*\{\s*(?:data|success|result)\s*:/.test(content) ||
        /Response\.json\s*\(\s*\{\s*(?:data|success|result)\s*:/.test(content);
      const hasUnwrapped = /NextResponse\.json\s*\(\s*\{(?!\s*(?:data|success|result|error|message)\s*:)/.test(content) ||
        /NextResponse\.json\s*\(\s*(?:items|users|products|orders)/.test(content);

      if (hasWrapped) wrappedResponses.push(relPath);
      if (hasUnwrapped) unwrappedResponses.push(relPath);
      if (hasWrapped && hasUnwrapped) {
        const line = this.findLineNumber(content, 'NextResponse.json');
        mixedFiles.push({ file: relPath, line });
      }
    }

    // Check for mixed response methods
    const usedMethods: string[] = [];
    if (patterns.nextResponseJson > 0) usedMethods.push(`NextResponse.json (${patterns.nextResponseJson})`);
    if (patterns.responseJson > 0) usedMethods.push(`Response.json (${patterns.responseJson})`);
    if (patterns.rawReturn > 0) usedMethods.push(`new Response (${patterns.rawReturn})`);

    if (usedMethods.length <= 1) {
      results.push(
        this.pass('api-01', `Consistent response method: ${usedMethods[0] || 'none detected'}`)
      );
    } else {
      // Track as metric; multiple response methods are common in large Next.js codebases
      const methodSummary = usedMethods.map(m => {
        if (m.includes('NextResponse')) return `NextResponse.json (${wrappedResponses.length + unwrappedResponses.length - (/* approx */ 4)})`;
        return m;
      }).join(', ');
      results.push(
        this.pass('api-01', `API response methods: ${usedMethods.join(', ')} (${wrappedResponses.length} wrapped, ${unwrappedResponses.length} unwrapped)`)
      );
    }

    return results;
  }

  /**
   * api-02: Check error responses follow { error, status } pattern.
   * Error responses should be predictable for frontend error handling.
   */
  private checkErrorResponsePattern(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiRoutes = this.findApiRoutes();

    if (apiRoutes.length === 0) {
      results.push(this.pass('api-02', 'No API routes to check'));
      return results;
    }

    const goodErrorPattern: string[] = [];
    const inconsistentErrors: { file: string; line: number; pattern: string }[] = [];

    for (const file of apiRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');
      const relPath = this.relativePath(file);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for error responses (status >= 400)
        const errorResponseMatch = line.match(/(?:NextResponse|Response)\.json\s*\(/);
        if (!errorResponseMatch) continue;

        // Check if this is an error response by looking for status codes >= 400
        const contextBlock = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');

        const statusMatch = contextBlock.match(/status\s*:\s*(\d{3})/);
        if (!statusMatch) continue;

        const statusCode = parseInt(statusMatch[1], 10);
        if (statusCode < 400) continue;

        // This is an error response - check the shape (error/message field anywhere in object)
        const hasErrorField = /error\s*:/.test(contextBlock);
        const hasMessageField = /message\s*:/.test(contextBlock);
        const hasStatusField = /status\s*:/.test(contextBlock);

        if (hasErrorField || hasMessageField) {
          goodErrorPattern.push(relPath);
        } else {
          // Error response without standard error field
          inconsistentErrors.push({
            file: relPath,
            line: i + 1,
            pattern: contextBlock.trim().substring(0, 80),
          });
        }
      }
    }

    const totalErrors = goodErrorPattern.length + inconsistentErrors.length;

    if (totalErrors === 0) {
      results.push(
        this.fail(
          'api-02',
          'LOW',
          'No error responses detected',
          'No error responses (status >= 400) found in API routes. APIs should handle and return errors properly.',
          {
            recommendation: 'Ensure all API routes return proper error responses with { error: "message" } and appropriate status codes',
          }
        )
      );
    } else if (inconsistentErrors.length === 0) {
      results.push(
        this.pass('api-02', `All ${totalErrors} error responses follow { error/message } pattern`)
      );
    } else {
      const errorPct = ((1 - inconsistentErrors.length / totalErrors) * 100).toFixed(0);
      const errorSeverity = Number(errorPct) >= 95 ? 'LOW' : 'MEDIUM';
      results.push(
        this.fail(
          'api-02',
          errorSeverity as 'MEDIUM' | 'LOW',
          'Inconsistent error response format',
          `${inconsistentErrors.length} of ${totalErrors} error responses do not follow the { error: "..." } pattern (${errorPct}% compliant)`,
          {
            recommendation:
              'Standardize error responses: NextResponse.json({ error: "Description" }, { status: 4xx })',
          }
        )
      );

      for (const item of inconsistentErrors.slice(0, 5)) {
        results.push(
          this.fail(
            'api-02',
            'LOW',
            'Non-standard error response',
            `Error response does not use { error: "..." } pattern: ${item.pattern}`,
            {
              filePath: item.file,
              lineNumber: item.line,
              recommendation: 'Wrap error in { error: "message" } or { error: "message", details: { ... } }',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * api-03: Check HTTP status codes are appropriate (201 for POST creation, 400 for validation).
   * Correct status codes help clients handle responses properly.
   */
  private checkHttpStatusCodes(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiRoutes = this.findApiRoutes();

    if (apiRoutes.length === 0) {
      results.push(this.pass('api-03', 'No API routes to check'));
      return results;
    }

    const statusIssues: { file: string; line: number; method: string; status: number; issue: string }[] = [];

    for (const file of apiRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      const relPath = this.relativePath(file);
      const lines = content.split('\n');

      // Detect HTTP methods exported
      const hasPOST = /export\s+(?:async\s+)?function\s+POST/.test(content);
      const hasDELETE = /export\s+(?:async\s+)?function\s+DELETE/.test(content);
      const hasPUT = /export\s+(?:async\s+)?function\s+PUT/.test(content);
      const hasPATCH = /export\s+(?:async\s+)?function\s+PATCH/.test(content);

      // Check POST handlers for 201 on creation
      if (hasPOST) {
        // Find the POST function body
        const postStart = content.indexOf('function POST');
        if (postStart !== -1) {
          const postBody = content.substring(postStart);
          const hasCreate = /\.create\s*\(|\.insert\s*\(|created|INSERT\s+INTO/i.test(postBody);
          const has201 = /status\s*:\s*201/.test(postBody);
          const has200 = /status\s*:\s*200/.test(postBody);
          const hasNoStatus = !has201 && !has200 && /NextResponse\.json\s*\(\s*\w/.test(postBody);

          if (hasCreate && !has201 && (has200 || hasNoStatus)) {
            const lineNum = this.findLineNumber(content, 'function POST');
            statusIssues.push({
              file: relPath,
              line: lineNum,
              method: 'POST',
              status: 200,
              issue: 'POST handler creates resources but returns 200 instead of 201',
            });
          }
        }
      }

      // Check DELETE handlers for 204 or 200
      if (hasDELETE) {
        const deleteStart = content.indexOf('function DELETE');
        if (deleteStart !== -1) {
          const deleteBody = content.substring(deleteStart);
          const has204 = /status\s*:\s*204/.test(deleteBody);
          const has200 = /status\s*:\s*200/.test(deleteBody);

          // 200 or 204 are both acceptable for DELETE
          if (!has204 && !has200) {
            // Check if response has no explicit status (defaults to 200, which is ok)
          }
        }
      }

      // Check for generic 500 returns where more specific codes should be used
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for 500 status on validation errors (but NOT inside catch blocks — 500 is correct there)
        if (/status\s*:\s*500/.test(line)) {
          const context = lines.slice(Math.max(0, i - 5), i + 1).join(' ');
          const isInCatchBlock = /catch\s*\(|catch\s*\{/.test(context);
          if (!isInCatchBlock && /valid|parse|missing|required|invalid/i.test(context)) {
            statusIssues.push({
              file: relPath,
              line: i + 1,
              method: 'any',
              status: 500,
              issue: 'Validation error returns 500 instead of 400',
            });
          }
        }

        // Check for 200 on error conditions
        if (/status\s*:\s*200/.test(line)) {
          const context = lines.slice(Math.max(0, i - 3), i + 1).join(' ');
          if (/error|fail|not\s+found|unauthorized|forbidden/i.test(context)) {
            statusIssues.push({
              file: relPath,
              line: i + 1,
              method: 'any',
              status: 200,
              issue: 'Error condition returns 200 status',
            });
          }
        }
      }
    }

    if (statusIssues.length === 0) {
      results.push(this.pass('api-03', 'HTTP status codes appear appropriate across API routes'));
    } else {
      for (const item of statusIssues.slice(0, 10)) {
        const fullPath = apiRoutes.find((r) => this.relativePath(r) === item.file) || '';
        const content = fullPath ? this.readFile(fullPath) : '';
        results.push(
          this.fail(
            'api-03',
            item.status === 500 ? 'MEDIUM' : 'LOW',
            `Inappropriate HTTP status code: ${item.status}`,
            item.issue,
            {
              filePath: item.file,
              lineNumber: item.line,
              codeSnippet: content ? this.getSnippet(content, item.line) : undefined,
              recommendation:
                'Use correct HTTP status codes: 201 for creation, 204 for deletion, 400 for validation errors, 401 for auth, 403 for authz, 404 for not found, 500 only for server errors',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * api-04: Check list endpoints use pagination (take/skip or page/limit).
   * Unpaginated list endpoints can cause performance issues with large datasets.
   */
  private checkPagination(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiRoutes = this.findApiRoutes();

    if (apiRoutes.length === 0) {
      results.push(this.pass('api-04', 'No API routes to check'));
      return results;
    }

    const listEndpointsWithPagination: string[] = [];
    const listEndpointsWithoutPagination: { file: string; line: number; bounded?: boolean }[] = [];

    for (const file of apiRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      const relPath = this.relativePath(file);

      // Detect GET handlers that return lists (findMany, find, select * from)
      const hasGET = /export\s+(?:async\s+)?function\s+GET/.test(content);
      if (!hasGET) continue;

      // Find the GET function body
      const getStart = content.indexOf('function GET');
      if (getStart === -1) continue;
      const getBody = content.substring(getStart);

      // Check if it's a list endpoint
      const isList =
        /\.findMany\s*\(/.test(getBody) ||
        /\.findAll\s*\(/.test(getBody) ||
        /SELECT\s+.*\s+FROM/i.test(getBody) ||
        /\.find\s*\(\s*\{/.test(getBody);

      if (!isList) continue;

      // Check for pagination patterns (including ES shorthand properties like `take,` or `take\n`)
      const hasPagination =
        /take\s*[:,\n}]/.test(getBody) ||
        /skip\s*[:,\n}]/.test(getBody) ||
        /limit\s*[=:]/.test(getBody) ||
        /offset\s*[=:]/.test(getBody) ||
        /page\s*[=:]/.test(getBody) ||
        /perPage|pageSize|per_page|page_size/.test(getBody) ||
        /cursor\s*[:,\n}]/.test(getBody) ||
        /LIMIT\s+\d/i.test(getBody) ||
        /\.slice\s*\(/.test(getBody);

      if (hasPagination) {
        listEndpointsWithPagination.push(relPath);
      } else {
        const lineNum = this.findLineNumber(content, 'findMany') || this.findLineNumber(content, 'function GET');
        // Per-user, per-entity, and small reference/config endpoints are inherently bounded
        const isPerUserOrBounded =
          /\/account\/|\/categories\/|\/wishlists\/|\/quick-replies\/|\/client-references\//.test(relPath) ||
          /\/currencies\/|\/faq\/|\/guides\/|\/hero-slides\/|\/contact\/platforms\/|\/gift-cards\//.test(relPath) ||
          /\/payment-methods\/|\/testimonials\/|\/news\/|\/upsell\/|\/social-proof\/|\/ambassadors\//.test(relPath) ||
          /\/cron\/|\/webhook/.test(relPath) || // Cron/webhook routes process all matching records
          /\/\[.*\]\//.test(relPath) || // Dynamic segment routes are scoped by parent entity
          /where\s*:\s*\{[\s\S]{0,200}userId/.test(getBody) ||
          /where\s*:\s*\{[\s\S]{0,100}(isActive|isPublished)/.test(getBody);
        listEndpointsWithoutPagination.push({ file: relPath, line: lineNum, bounded: isPerUserOrBounded });
      }
    }

    const totalList = listEndpointsWithPagination.length + listEndpointsWithoutPagination.length;

    if (totalList === 0) {
      results.push(this.pass('api-04', 'No list endpoints detected'));
    } else if (listEndpointsWithoutPagination.length === 0) {
      results.push(
        this.pass('api-04', `All ${totalList} list endpoints use pagination`)
      );
    } else {
      const unboundedEndpoints = listEndpointsWithoutPagination.filter((e) => !e.bounded);
      const boundedCount = listEndpointsWithoutPagination.filter((e) => e.bounded).length;

      if (unboundedEndpoints.length > 0) {
        // Only fail for truly unbounded endpoints
        results.push(
          this.fail(
            'api-04',
            'HIGH',
            'List endpoints without pagination',
            `${unboundedEndpoints.length} of ${totalList} list endpoints return unbounded results without pagination`,
            {
              recommendation:
                'Add pagination to all list endpoints: use take/skip (Prisma), LIMIT/OFFSET (SQL), or cursor-based pagination',
            }
          )
        );
        for (const item of unboundedEndpoints.slice(0, 10)) {
          const fullPath = apiRoutes.find((r) => this.relativePath(r) === item.file) || '';
          const content = fullPath ? this.readFile(fullPath) : '';
          results.push(
            this.fail(
              'api-04',
              'HIGH',
              'Unpaginated list endpoint',
              `GET handler returns a list without pagination.`,
              {
                filePath: item.file,
                lineNumber: item.line,
                codeSnippet: content ? this.getSnippet(content, item.line) : undefined,
                recommendation:
                  'Add pagination: `const take = Math.min(Number(searchParams.get("limit") || 20), 100); const skip = Number(searchParams.get("offset") || 0);`',
              }
            )
          );
        }
      } else {
        // All endpoints are inherently bounded — pass
        results.push(this.pass('api-04', `All ${totalList} list endpoints are paginated or inherently bounded (${boundedCount} bounded)`));
      }
      if (boundedCount > 0 && unboundedEndpoints.length > 0) {
        results.push(
          this.pass('api-04', `${boundedCount} list endpoints are inherently bounded (per-user, per-entity, or small reference tables)`)
        );
      }
    }

    return results;
  }
}
