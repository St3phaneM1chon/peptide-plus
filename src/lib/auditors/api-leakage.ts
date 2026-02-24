/**
 * API-LEAKAGE Auditor
 * Checks for sensitive data leakage in API responses: passwords,
 * full object returns, stack traces, and internal ID exposure.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class ApiLeakageAuditor extends BaseAuditor {
  auditTypeCode = 'API-LEAKAGE';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkPasswordLeakage());
    results.push(...this.checkSelectUsage());
    results.push(...this.checkStackTraceLeakage());
    results.push(...this.checkInternalIdExposure());

    return results;
  }

  /**
   * leak-01: Scan API responses for hashedPassword, password fields in prisma select/include
   */
  private checkPasswordLeakage(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiFiles = this.findApiRoutes();
    const libFiles = this.findLibFiles();
    const allFiles = [...apiFiles, ...libFiles];
    let foundIssue = false;

    const sensitiveFieldPatterns = [
      /hashedPassword/,
      /password\s*:/,
      /passwordHash/,
      /passwordDigest/,
      /secret\s*:/,
      /token\s*:/,
      /refreshToken/,
      /apiKey\s*:/,
      /privateKey/,
    ];

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const rel = this.relativePath(file).toLowerCase();

      // Skip integration management files - they intentionally store/retrieve credentials
      if (/integrations?\//.test(rel)) continue;
      // Skip translation service files that use API keys for external services
      if (/translation\/(queue|service)/i.test(rel)) continue;

      // Look for prisma queries that include/select sensitive fields
      for (const pattern of sensitiveFieldPatterns) {
        const match = content.match(pattern);
        if (!match) continue;

        // Check if it is within a select block that INCLUDES the field (not excludes it)
        const matchStr = match[0];
        const lineNum = this.findLineNumber(content, matchStr);
        const snippet = this.getSnippet(content, lineNum, 4);

        // Check for explicit exclusion patterns (e.g., `hashedPassword: false` in select)
        const exclusionPattern = new RegExp(
          `${matchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*false`
        );
        if (exclusionPattern.test(content)) continue;

        // Check if this is in a type definition or interface (not an actual query)
        const surroundingLines = this.getSnippet(content, lineNum, 6);
        if (/interface\s|type\s|\.d\.ts/.test(surroundingLines)) continue;

        // Skip password/hashedPassword being WRITTEN (in create/update data blocks)
        // These are being stored, not returned to the client
        if (/password/i.test(matchStr) || /hashedPassword/.test(matchStr)) {
          const usesBcryptCompare = /bcrypt\.compare|bcryptjs.*compare|argon2\.verify|compare\s*\(/i.test(content);
          const usesBcryptHash = /bcrypt\.hash|bcryptjs.*hash|argon2\.hash|import\s*\{[^}]*hash[^}]*\}\s*from\s*['"]bcrypt/i.test(content);
          const hasZodPasswordField = /password:\s*z\./.test(content);
          const passwordInResponse = /NextResponse\.json\s*\([^)]*password|apiSuccess\s*\([^)]*password|res\.json\s*\([^)]*password/i.test(content);
          // If hashing, comparing, or validating password input and never returning it → safe
          if ((usesBcryptCompare || usesBcryptHash || hasZodPasswordField) && !passwordInResponse) continue;
        }

        // Skip token: when used for verification/lookup (find by token, JWT verify, not returned)
        if (/token\s*:/.test(matchStr)) {
          const isTokenLookup = /where[\s\S]{0,100}token|unsubscribeToken/i.test(content);
          const isTokenWrite = /data[\s\S]{0,100}(?:reset)?[Tt]oken\s*:|clearToken|null/i.test(content);
          const isJwtVerify = /jwtVerify|jwt\.verify|verifyToken|jose/i.test(content);
          // Only flag if actual token VALUE is returned (not just error messages mentioning "token")
          const tokenValueInResponse = /NextResponse\.json\s*\(\s*\{[^}]*token\s*:/i.test(content) ||
            /apiSuccess\s*\([^)]*token\s*:/i.test(content);
          // Token used in where clauses, JWT verify, or being cleared → safe
          if ((isTokenLookup || isTokenWrite || isJwtVerify) && !tokenValueInResponse) continue;
        }

        // Skip secret: in non-response contexts (Zod validation input, env vars, webhook signatures)
        if (/secret\s*:/.test(matchStr)) {
          const isWebhookSecret = /webhook|CRON_SECRET|endpointSecret/i.test(content);
          if (isWebhookSecret) continue;
        }

        // Check if there is a select that omits the field (implicit exclusion via select)
        // If using `select:` and this field is NOT in it, that is fine
        const hasSelectBlock = /select\s*:\s*\{/.test(content);
        if (hasSelectBlock) {
          // The field is mentioned but might be excluded by select - check context
          const nearbyContent = this.getSnippet(content, lineNum, 10);
          if (/select\s*:/.test(nearbyContent) && /:\s*true/.test(nearbyContent)) {
            // Field is within a select block with true - this IS leaking
            foundIssue = true;
            results.push(
              this.fail('leak-01', 'CRITICAL', 'Sensitive field in select/include', `Sensitive field "${matchStr.trim()}" is included in a Prisma select/include block in ${this.relativePath(file)}. This data may be sent in API responses.`, {
                filePath: this.relativePath(file),
                lineNumber: lineNum,
                codeSnippet: snippet,
                recommendation:
                  'Remove sensitive fields from select/include blocks or explicitly set them to false. Use a DTO/mapper to strip sensitive data before responding.',
              })
            );
          }
        } else {
          // No select block = returning full object including sensitive fields
          const hasPrismaQuery = /prisma\.\w+\.(findMany|findFirst|findUnique|create|update)/i.test(content);
          if (hasPrismaQuery) {
            foundIssue = true;
            results.push(
              this.fail('leak-01', 'HIGH', 'Sensitive field possibly exposed', `File ${this.relativePath(file)} references sensitive field "${matchStr.trim()}" and uses Prisma queries without select blocks. Full objects including sensitive fields may be returned.`, {
                filePath: this.relativePath(file),
                lineNumber: lineNum,
                codeSnippet: snippet,
                recommendation:
                  'Use `select` in Prisma queries to explicitly choose returned fields, excluding sensitive ones like hashedPassword, tokens, and API keys.',
              })
            );
          }
        }
      }
    }

    if (!foundIssue) {
      results.push(this.pass('leak-01', 'No sensitive field leakage detected'));
    }

    return results;
  }

  /**
   * leak-02: Check prisma queries use select instead of returning full objects
   */
  private checkSelectUsage(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiFiles = this.findApiRoutes();
    let totalQueries = 0;
    let queriesWithoutSelect = 0;
    const filesWithIssues: { file: string; lineNum: number; snippet: string }[] = [];

    for (const file of apiFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Find Prisma query calls
      const queryPattern =
        /prisma\.\w+\.(findMany|findFirst|findUnique|create|update)\s*\(/g;
      let queryMatch: RegExpExecArray | null;

      while ((queryMatch = queryPattern.exec(content)) !== null) {
        totalQueries++;
        const queryPos = queryMatch.index;
        // Look forward from the query for a select or include clause within reasonable range
        const afterQuery = content.substring(queryPos, queryPos + 500);

        const hasSelect = /select\s*:/.test(afterQuery);
        const hasInclude = /include\s*:/.test(afterQuery);

        if (!hasSelect && !hasInclude) {
          queriesWithoutSelect++;
          const lineNum = this.findLineNumber(content, queryMatch[0]);
          if (filesWithIssues.length < 5) {
            filesWithIssues.push({
              file: this.relativePath(file),
              lineNum,
              snippet: this.getSnippet(content, lineNum),
            });
          }
        }
      }
    }

    if (totalQueries === 0) {
      results.push(this.pass('leak-02', 'No Prisma queries found in API routes'));
    } else if (queriesWithoutSelect === 0) {
      results.push(
        this.pass('leak-02', 'All API Prisma queries use select or include')
      );
    } else {
      const percentage = Math.round((queriesWithoutSelect / totalQueries) * 100);
      const topFiles = filesWithIssues.slice(0, 5).map(i => `${i.file}:${i.lineNum}`).join(', ');
      results.push(
        this.fail('leak-02', 'MEDIUM', 'Prisma queries without select in API routes',
          `${queriesWithoutSelect}/${totalQueries} (${percentage}%) Prisma queries in API routes return full objects without select. Top files: ${topFiles}`,
          {
            recommendation:
              'Use `select: { ... }` in Prisma queries to return only needed fields. This improves security and performance.',
          })
      );
    }

    return results;
  }

  /**
   * leak-03: Check error responses don't include stack traces
   */
  private checkStackTraceLeakage(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiFiles = this.findApiRoutes();
    let foundIssue = false;

    for (const file of apiFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const stackTracePatterns = [
        { pattern: /err\.stack/, label: 'err.stack' },
        { pattern: /error\.stack/, label: 'error.stack' },
        { pattern: /\.stack\s*[,})\]]/, label: '.stack in response' },
        { pattern: /JSON\.stringify\(\s*(?:err|error)\s*\)/, label: 'JSON.stringify(error)' },
        { pattern: /message:\s*(?:err|error)\.message/, label: 'raw error message in response' },
      ];

      for (const { pattern, label } of stackTracePatterns) {
        const match = content.match(pattern);
        if (!match) continue;

        // Check if this is in a catch block that sends a response
        const lineNum = this.findLineNumber(content, match[0]);
        const context = this.getSnippet(content, lineNum, 6);

        // Check if the stack/error is being sent in a response (NextResponse, Response, res.json)
        const isInResponse =
          /NextResponse\.json|Response\.json|res\.json|res\.status/.test(context);
        const isLogging =
          /console\.(log|error|warn)|logger\.(log|error|warn)/.test(context);

        if (isInResponse && !isLogging) {
          foundIssue = true;
          results.push(
            this.fail('leak-03', 'HIGH', 'Stack trace in API response', `${label} found in API response at ${this.relativePath(file)}. Stack traces expose internal paths, file names, and implementation details.`, {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: this.getSnippet(content, lineNum),
              recommendation:
                'Return generic error messages to clients (e.g., "Internal server error"). Log detailed errors server-side only. Never include err.stack or full error objects in API responses.',
            })
          );
        }
      }
    }

    if (!foundIssue) {
      results.push(
        this.pass('leak-03', 'No stack trace leakage found in API responses')
      );
    }

    return results;
  }

  /**
   * leak-04: Check for internal ID exposure patterns
   */
  private checkInternalIdExposure(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiFiles = this.findApiRoutes();
    let foundIssue = false;

    for (const file of apiFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check for auto-increment IDs being used in URLs (sequential enumeration risk)
      const internalIdPatterns = [
        {
          pattern: /params\.\w*[Ii]d\b/,
          label: 'Sequential ID in URL params',
          check: () => {
            // Check schema for autoincrement on the relevant model
            const schema = this.readFile(`${this.rootDir}/prisma/schema.prisma`);
            return /id\s+Int\s+@id\s+@default\(autoincrement\(\)\)/.test(schema);
          },
        },
      ];

      for (const { pattern, label, check } of internalIdPatterns) {
        if (pattern.test(content) && check()) {
          const match = content.match(pattern);
          if (!match) continue;
          const lineNum = this.findLineNumber(content, match[0]);

          // Only flag if the route does not do authorization checks
          const hasAuthCheck =
            /getServerSession|auth\(\)|getSession|requireAuth|checkAuth|session\?\.user/.test(
              content
            );

          if (!hasAuthCheck) {
            foundIssue = true;
            results.push(
              this.fail('leak-04', 'MEDIUM', 'Internal sequential ID exposure without auth', `${this.relativePath(file)} uses sequential integer IDs in URL parameters without apparent authorization checks. Attackers can enumerate resources by incrementing IDs.`, {
                filePath: this.relativePath(file),
                lineNumber: lineNum,
                codeSnippet: this.getSnippet(content, lineNum),
                recommendation:
                  'Use UUIDs or CUIDs instead of auto-increment IDs for public-facing resources. If sequential IDs must be used, ensure authorization checks verify the user owns the resource.',
              })
            );
          }
        }
      }
    }

    if (!foundIssue) {
      results.push(this.pass('leak-04', 'No internal ID exposure issues found'));
    }

    return results;
  }
}
