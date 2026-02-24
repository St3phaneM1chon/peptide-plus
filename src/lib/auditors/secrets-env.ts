/**
 * SECRETS-ENV Auditor
 * Scans for hardcoded secrets, env variable misuse, and sensitive data exposure.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class SecretsEnvAuditor extends BaseAuditor {
  auditTypeCode = 'SECRETS-ENV';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkHardcodedSecrets());
    results.push(...this.checkGitignoreIncludesEnv());
    results.push(...this.checkNextPublicSensitiveVars());
    results.push(...this.checkClientComponentsServerEnv());
    results.push(...this.checkConsoleLogEnvVars());

    return results;
  }

  /**
   * secrets-01: Scan for hardcoded secrets (API keys, passwords, tokens)
   * Looks for long alphanumeric strings near secret-related keywords.
   */
  private checkHardcodedSecrets(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    // Patterns that indicate a hardcoded secret
    const secretKeywordPatterns = [
      // Variable assignment patterns near secret words
      /(?:api[_-]?key|apiKey|secret|password|passwd|token|auth[_-]?token|access[_-]?token|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"`]([A-Za-z0-9+/=_-]{32,})['"`]/gi,
      // Bearer tokens hardcoded
      /['"`]Bearer\s+([A-Za-z0-9._-]{20,})['"`]/g,
      // AWS-style keys
      /['"`](AKIA[0-9A-Z]{16})['"`]/g,
      // Stripe-style keys
      /['"`](sk_(?:live|test)_[A-Za-z0-9]{20,})['"`]/g,
      /['"`](pk_(?:live|test)_[A-Za-z0-9]{20,})['"`]/g,
      // Generic long hex strings assigned to secret-like vars
      /(?:secret|key|token|password)\s*[:=]\s*['"`]([0-9a-f]{32,})['"`]/gi,
    ];

    // Files to skip (config examples, test fixtures, type definitions)
    const skipPatterns = ['.test.', '.spec.', '.d.ts', '__mocks__', 'fixtures', '.example'];

    let hardcodedCount = 0;

    for (const file of tsFiles) {
      if (skipPatterns.some((skip) => file.includes(skip))) continue;

      const content = this.readFile(file);
      if (!content) continue;

      for (const pattern of secretKeywordPatterns) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          const line = content.split('\n')[lineNum - 1] || '';

          // Skip if the value comes from process.env
          if (/process\.env/.test(line)) continue;
          // Skip if it looks like a type annotation or interface
          if (/:\s*string|interface\s|type\s/.test(line)) continue;
          // Skip comments
          if (/^\s*\/\/|^\s*\*|^\s*\/\*/.test(line)) continue;
          // Skip placeholder/example values
          if (/example|placeholder|your[_-]?key|xxx|changeme|dummy|test/i.test(match[1] || match[0])) continue;

          hardcodedCount++;
          const maskedMatch = match[0].substring(0, 30) + '...[REDACTED]';

          results.push(
            this.fail('secrets-01', 'CRITICAL', 'Potential hardcoded secret detected', `Found what appears to be a hardcoded secret near: ${maskedMatch}`, {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: this.getSnippet(content, lineNum, 1),
              recommendation: 'Move secrets to environment variables. Use process.env.VARIABLE_NAME and add the variable to .env.local (not committed)',
            })
          );

          // Only report first match per file per pattern to avoid noise
          break;
        }
      }
    }

    if (hardcodedCount === 0) {
      results.push(this.pass('secrets-01', 'No hardcoded secrets detected in source files'));
    }

    return results;
  }

  /**
   * secrets-02: Check .gitignore includes .env files
   */
  private checkGitignoreIncludesEnv(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const gitignorePath = path.join(this.rootDir, '.gitignore');
    const content = this.readFile(gitignorePath);

    if (!content) {
      results.push(
        this.fail('secrets-02', 'CRITICAL', 'No .gitignore file found', 'Project has no .gitignore file. Environment files with secrets may be committed.', {
          recommendation: 'Create a .gitignore file that includes .env, .env.local, .env.*.local',
        })
      );
      return results;
    }

    const lines = content.split('\n').map((l) => l.trim());

    const requiredPatterns = [
      { pattern: '.env', desc: '.env' },
      { pattern: '.env.local', desc: '.env.local' },
    ];

    const missingPatterns: string[] = [];

    for (const { pattern, desc } of requiredPatterns) {
      // Check if the pattern is covered by any gitignore rule
      const isCovered = lines.some((line) => {
        if (line.startsWith('#') || !line) return false;
        // Exact match
        if (line === pattern) return true;
        // Wildcard match (e.g., ".env*" covers ".env.local")
        if (line === '.env*' || line === '.env.*') return true;
        // Specific pattern
        if (line === '.env.*.local') return pattern.includes('.local');
        return false;
      });

      if (!isCovered) {
        missingPatterns.push(desc);
      }
    }

    if (missingPatterns.length === 0) {
      results.push(this.pass('secrets-02', '.gitignore properly excludes .env files'));
    } else {
      results.push(
        this.fail('secrets-02', 'CRITICAL', '.gitignore missing env file exclusions', `The following patterns are not in .gitignore: ${missingPatterns.join(', ')}`, {
          filePath: '.gitignore',
          recommendation: `Add the following to .gitignore:\n.env\n.env.local\n.env.*.local`,
        })
      );
    }

    // Also check that .env files are not tracked
    const envFilesToCheck = ['.env', '.env.local', '.env.production'];
    for (const envFile of envFilesToCheck) {
      const envPath = path.join(this.rootDir, envFile);
      const envContent = this.readFile(envPath);
      if (envContent && /(?:SECRET|PASSWORD|KEY|TOKEN)\s*=\s*\S+/.test(envContent)) {
        // File exists and has secrets - ensure it is gitignored
        // (we cannot check git tracking from here, but we flag it)
        const isGitignored = lines.some(
          (line) => line === envFile || line === '.env*' || line === '.env' || line === '.env.*'
        );
        if (!isGitignored) {
          results.push(
            this.fail('secrets-02', 'CRITICAL', `${envFile} with secrets may not be gitignored`, `${envFile} contains secret values and may not be properly excluded from git`, {
              filePath: envFile,
              recommendation: `Ensure ${envFile} is listed in .gitignore and not tracked by git`,
            })
          );
        }
      }
    }

    return results;
  }

  /**
   * secrets-03: Check NEXT_PUBLIC_ env vars for sensitive names
   * NEXT_PUBLIC_ vars are exposed to the browser bundle - they should not contain secrets.
   */
  private checkNextPublicSensitiveVars(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Scan all files for NEXT_PUBLIC_ usage
    const allFiles = [
      ...this.findFiles(this.srcDir, /\.tsx?$/),
      ...['.env', '.env.local', '.env.production'].map((f) => path.join(this.rootDir, f)),
    ];

    const sensitiveWords = ['secret', 'password', 'private', 'token', 'auth', 'key'];

    // --- Whitelist: known-safe NEXT_PUBLIC_ variables ---
    // These are explicitly designed to be public/client-side.
    const allowedExactNames = new Set([
      // Stripe publishable key (designed to be public, starts with pk_)
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      // reCAPTCHA site key (public by design, the secret key is separate)
      'NEXT_PUBLIC_RECAPTCHA_SITE_KEY',
      // Sentry DSN (public, used for error reporting from browser)
      'NEXT_PUBLIC_SENTRY_DSN',
      // Analytics IDs (public tracking identifiers)
      'NEXT_PUBLIC_GA_ID',
      'NEXT_PUBLIC_GA_MEASUREMENT_ID',
      'NEXT_PUBLIC_ANALYTICS_ID',
      // Google Places/Maps API key (restricted by HTTP referrer, must be client-side)
      'NEXT_PUBLIC_GOOGLE_PLACES_API_KEY',
      'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
      // Meta Pixel ID (public tracking identifier)
      'NEXT_PUBLIC_META_PIXEL_ID',
    ]);

    // Patterns for NEXT_PUBLIC_ names that are inherently safe regardless of
    // containing a sensitive keyword (e.g., NEXT_PUBLIC_APP_URL contains no secret).
    const safePatterns = [
      /^NEXT_PUBLIC_.*_URL$/,         // URLs (APP_URL, SITE_URL, SHOP_URL, etc.)
      /^NEXT_PUBLIC_.*_EMAIL$/,       // Public contact emails
      /^NEXT_PUBLIC_.*_NAME$/,        // Display names (SITE_NAME, APP_NAME)
      /^NEXT_PUBLIC_.*_DESCRIPTION$/, // Site descriptions
      /^NEXT_PUBLIC_.*_PHONE$/,       // Public phone numbers
      /^NEXT_PUBLIC_.*_ADDRESS$/,     // Public addresses
      /^NEXT_PUBLIC_.*_CITY$/,        // City names
      /^NEXT_PUBLIC_.*_ID$/,          // Public identifiers (GA_ID, PIXEL_ID)
      /PUBLISHABLE/i,                 // Any publishable key
      /SITE_KEY/i,                    // Site keys (reCAPTCHA-style)
    ];

    const flaggedVars = new Set<string>();

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const publicVarRegex = /NEXT_PUBLIC_[A-Z_]+/g;
      let match;

      while ((match = publicVarRegex.exec(content)) !== null) {
        const varName = match[0];

        // Skip exact whitelist matches
        if (allowedExactNames.has(varName)) continue;

        // Skip pattern-based safe names
        if (safePatterns.some((pattern) => pattern.test(varName))) continue;

        const varNameLower = varName.toLowerCase();
        const isSensitive = sensitiveWords.some((word) => varNameLower.includes(word));

        if (isSensitive) {
          flaggedVars.add(varName);
        }
      }
    }

    if (flaggedVars.size === 0) {
      results.push(this.pass('secrets-03', 'No sensitive NEXT_PUBLIC_ variable names detected'));
    } else {
      results.push(
        this.fail('secrets-03', 'HIGH', 'NEXT_PUBLIC_ variable with sensitive name', `The following NEXT_PUBLIC_ variables have sensitive names and will be exposed in the browser bundle:\n${[...flaggedVars].join('\n')}`, {
          recommendation: 'NEXT_PUBLIC_ variables are embedded in the client bundle. Remove the NEXT_PUBLIC_ prefix for server-only secrets, or rename to avoid sensitive keywords if the value is truly public.',
        })
      );
    }

    return results;
  }

  /**
   * secrets-04: Client components should not reference server-only env vars
   * Files with 'use client' should only access NEXT_PUBLIC_ vars.
   */
  private checkClientComponentsServerEnv(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsxFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    let violationCount = 0;
    const violations: Array<{ file: string; varName: string; line: number }> = [];

    for (const file of tsxFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Only check client components
      if (!content.startsWith("'use client'") && !content.startsWith('"use client"')) continue;

      // Find all process.env references that are NOT NEXT_PUBLIC_
      const envRegex = /process\.env\.([A-Z_]+)/g;
      let match;

      while ((match = envRegex.exec(content)) !== null) {
        const varName = match[1];
        if (varName.startsWith('NEXT_PUBLIC_')) continue;
        if (varName === 'NODE_ENV') continue; // NODE_ENV is always available

        violationCount++;
        const lineNum = content.substring(0, match.index).split('\n').length;
        violations.push({ file: this.relativePath(file), varName, line: lineNum });
      }
    }

    if (violationCount === 0) {
      results.push(this.pass('secrets-04', 'Client components do not reference server-only env vars'));
    } else {
      // Report up to 5 individual findings
      for (const v of violations.slice(0, 5)) {
        results.push(
          this.fail('secrets-04', 'HIGH', 'Client component references server env var', `'use client' component accesses process.env.${v.varName} which is undefined in the browser and may indicate a leaked secret reference`, {
            filePath: v.file,
            lineNumber: v.line,
            recommendation: `Server-only env vars are not available in client components. Use NEXT_PUBLIC_ prefix for client vars, or move this logic to a Server Component or API route.`,
          })
        );
      }

      if (violations.length > 5) {
        results.push(
          this.fail('secrets-04', 'HIGH', `${violations.length - 5} more client env var violations`, `Total of ${violations.length} client components reference server-only env vars. Review all 'use client' files.`, {
            recommendation: 'Audit all client components for process.env references. Only NEXT_PUBLIC_ and NODE_ENV are available client-side.',
          })
        );
      }
    }

    return results;
  }

  /**
   * secrets-05: Check console.log statements for env var output
   *
   * We distinguish between:
   *   - DANGEROUS: console.log('key:', process.env.SECRET_KEY)  — logs the VALUE
   *   - SAFE:      console.log('configured:', !!process.env.SECRET_KEY)  — logs boolean existence
   *   - SAFE:      console.warn(JSON.stringify({ event: 'no_auth_secret' }))  — string literal only
   */
  private checkConsoleLogEnvVars(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    // Skip test files and auditor source files (auditors contain detection
    // heuristic examples in comments/docs that would trigger false positives)
    const skipPatterns = ['.test.', '.spec.', '__tests__', '__mocks__', '/auditors/'];

    let logCount = 0;
    const logLocations: Array<{ file: string; line: number }> = [];

    for (const file of tsFiles) {
      if (skipPatterns.some((s) => file.includes(s))) continue;

      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments
        if (/^\s*\/\//.test(line)) continue;

        // Must be a console output statement
        if (!/console\.(?:log|info|debug|warn|error)\s*\(/.test(line)) continue;

        // --- Check 1: console.log with process.env (may expose value) ---
        if (/process\.env/.test(line)) {
          // Allow logging NODE_ENV (always safe)
          const envRefs = line.match(/process\.env\.[A-Z_]+/g) || [];
          const nonNodeEnvRefs = envRefs.filter((ref) => ref !== 'process.env.NODE_ENV');

          if (nonNodeEnvRefs.length === 0) continue;

          // Safe pattern: !!process.env.VAR (existence check, logs true/false)
          const allRefsAreSafe = nonNodeEnvRefs.every((ref) => {
            // Check if this ref is preceded by !! (boolean coercion / existence check)
            const escapedRef = ref.replace(/\./g, '\\.');
            return new RegExp(`!!\\s*${escapedRef}`).test(line);
          });

          if (allRefsAreSafe) continue;

          logCount++;
          logLocations.push({ file: this.relativePath(file), line: i + 1 });
          continue; // Don't double-count with check 2
        }

        // --- Check 2: console.log with secret-like variable names ---
        // Only flag when the sensitive word appears as a variable/identifier being
        // output, NOT when it's inside a string literal (e.g., event name).
        if (
          /(?:secret|password|token|apiKey|api_key|privateKey|private_key)/i.test(line) &&
          !/\/\/\s*(?:eslint|TODO|FIXME|noqa)/.test(line)
        ) {
          // Exclude lines where the sensitive word is ONLY inside string literals.
          // Strip all quoted strings and check if the sensitive word still appears.
          const withoutStrings = line
            .replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '')  // Remove single/double/template strings
            .replace(/\/\/.*$/, '');                         // Remove trailing comments

          const hasSensitiveOutsideStrings = /(?:secret|password|token|apiKey|api_key|privateKey|private_key)/i.test(withoutStrings);

          if (!hasSensitiveOutsideStrings) continue;

          logCount++;
          logLocations.push({ file: this.relativePath(file), line: i + 1 });
        }
      }
    }

    if (logCount === 0) {
      results.push(this.pass('secrets-05', 'No console.log statements output env vars or secrets'));
    } else {
      for (const loc of logLocations.slice(0, 5)) {
        const content = this.readFile(path.join(this.rootDir, loc.file));
        results.push(
          this.fail('secrets-05', 'MEDIUM', 'console.log may output sensitive env variable', `Console output includes environment variable or secret-like variable`, {
            filePath: loc.file,
            lineNumber: loc.line,
            codeSnippet: content ? this.getSnippet(content, loc.line, 1) : undefined,
            recommendation: 'Remove console.log statements that output environment variables or secrets. Use a structured logger that redacts sensitive values, or use !!process.env.VAR to log only existence (true/false).',
          })
        );
      }

      if (logLocations.length > 5) {
        results.push(
          this.fail('secrets-05', 'MEDIUM', `${logLocations.length - 5} more console.log env var findings`, `Total of ${logLocations.length} console statements may output sensitive data`, {
            recommendation: 'Remove or replace all console.log statements that reference env vars or secret-like variables',
          })
        );
      }
    }

    return results;
  }
}
