/**
 * CSRF-RATELIMIT Auditor
 * Checks CSRF token validation on mutation endpoints and rate-limiting on sensitive endpoints.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class CsrfRatelimitAuditor extends BaseAuditor {
  auditTypeCode = 'CSRF-RATELIMIT';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkCsrfOnMutationRoutes());
    results.push(...this.checkRateLimiterOnAuthEndpoints());
    results.push(...this.checkRateLimiterOnPaymentEndpoints());
    results.push(...this.checkRateLimiterOnContactEndpoints());
    results.push(...this.checkRateLimiterInfrastructure());

    return results;
  }

  /**
   * csrf-01: POST/PUT/PATCH/DELETE routes must validate CSRF
   * withAdminGuard includes CSRF validation, so routes using it are covered.
   */
  private checkCsrfOnMutationRoutes(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiDir = path.join(this.srcDir, 'app', 'api');
    const routeFiles = this.findFiles(apiDir, /^route\.ts$/);

    if (routeFiles.length === 0) {
      results.push(this.pass('csrf-01', 'CSRF check (no API routes found)'));
      return results;
    }

    const csrfPatterns = [
      /validateCsrf/,
      /csrfToken/,
      /withAdminGuard/,          // withAdminGuard includes CSRF
      /getCsrfToken/,
      /csrf/i,
      /x-csrf-token/i,
      /x-xsrf-token/i,
    ];

    // Routes that are exempt from CSRF (webhook receivers, NextAuth internals)
    const csrfExemptPaths = [
      '/api/webhook',
      '/api/payments/webhook',   // Stripe webhook receiver (uses signature verification)
      '/api/stripe/webhook',
      '/api/auth/',              // NextAuth handles its own CSRF
      '/api/cron',
    ];

    let unprotectedCount = 0;
    const unprotectedFiles: string[] = [];

    for (const file of routeFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check if route has mutation handlers
      const hasMutation = /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/.test(content);
      if (!hasMutation) continue;

      // Check if route is exempt
      const relPath = this.relativePath(file);
      const isExempt = csrfExemptPaths.some((exemptPath) => relPath.includes(exemptPath.replace(/\//g, path.sep)));
      if (isExempt) continue;

      // Check for CSRF protection
      const hasCsrf = csrfPatterns.some((pattern) => pattern.test(content));

      if (!hasCsrf) {
        unprotectedCount++;
        unprotectedFiles.push(relPath);
      }
    }

    if (unprotectedCount === 0) {
      results.push(this.pass('csrf-01', 'All mutation routes have CSRF protection or are exempt'));
    } else if (unprotectedCount <= 3) {
      for (const filePath of unprotectedFiles) {
        results.push(
          this.fail('csrf-01', 'HIGH', 'Mutation route missing CSRF validation', `POST/PUT/PATCH/DELETE handler has no CSRF token validation`, {
            filePath,
            recommendation: 'Add validateCsrf() call or use withAdminGuard() which includes CSRF validation',
          })
        );
      }
    } else {
      results.push(
        this.fail('csrf-01', 'HIGH', `${unprotectedCount} mutation routes missing CSRF validation`, `The following routes lack CSRF protection:\n${unprotectedFiles.slice(0, 10).join('\n')}${unprotectedCount > 10 ? `\n... and ${unprotectedCount - 10} more` : ''}`, {
          recommendation: 'Implement CSRF middleware or add validateCsrf() to all mutation endpoints. Consider a global middleware approach.',
        })
      );
    }

    return results;
  }

  /**
   * csrf-02: Auth endpoints (login, register, password reset) should have rate limiting
   */
  private checkRateLimiterOnAuthEndpoints(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const authDir = path.join(this.srcDir, 'app', 'api', 'auth');
    const authRoutes = this.findFiles(authDir, /^route\.ts$/);

    // Also check for auth-related routes outside /api/auth/
    const apiDir = path.join(this.srcDir, 'app', 'api');
    const allRoutes = this.findFiles(apiDir, /^route\.ts$/);
    const loginRoutes = allRoutes.filter((f) =>
      /login|signin|sign-in|register|signup|sign-up|forgot-password|reset-password/i.test(f)
    );

    const relevantRoutes = [...authRoutes, ...loginRoutes];

    if (relevantRoutes.length === 0) {
      results.push(this.pass('csrf-02', 'Auth rate limiting (no custom auth routes found)'));
      return results;
    }

    const rateLimitPatterns = [
      /rateLimit/i,
      /rateLimiter/i,
      /limiter/i,
      /throttle/i,
      /too.?many.?requests/i,
      /429/,
      /upstash.*ratelimit/i,
      /sliding.?window/i,
    ];

    let missingRateLimitCount = 0;

    for (const file of relevantRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      // Skip NextAuth catch-all (it has its own rate limiting via provider config)
      if (file.includes('[...nextauth]')) continue;

      const hasMutation = /export\s+(?:async\s+)?function\s+POST/.test(content);
      if (!hasMutation) continue;

      const hasRateLimit = rateLimitPatterns.some((p) => p.test(content));

      // Also check if imported from a middleware
      const hasRateLimitImport = /import.*(?:rateLimit|limiter|throttle)/i.test(content);

      if (!hasRateLimit && !hasRateLimitImport) {
        missingRateLimitCount++;
        results.push(
          this.fail('csrf-02', 'HIGH', 'Auth endpoint missing rate limiting', `Authentication endpoint has no rate limiting, enabling brute-force attacks`, {
            filePath: this.relativePath(file),
            recommendation: 'Add rate limiting (e.g., @upstash/ratelimit or custom sliding window) to prevent brute-force login attempts',
          })
        );
      }
    }

    if (missingRateLimitCount === 0) {
      results.push(this.pass('csrf-02', 'Auth endpoints have rate limiting'));
    }

    return results;
  }

  /**
   * csrf-03: Payment/checkout endpoints should have rate limiting
   */
  private checkRateLimiterOnPaymentEndpoints(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiDir = path.join(this.srcDir, 'app', 'api');
    const allRoutes = this.findFiles(apiDir, /^route\.ts$/);

    const paymentRoutes = allRoutes.filter((f) =>
      /payment|checkout|stripe|order|charge|subscribe/i.test(f)
    );

    if (paymentRoutes.length === 0) {
      results.push(this.pass('csrf-03', 'Payment rate limiting (no payment routes found)'));
      return results;
    }

    const rateLimitPatterns = [
      /rateLimit/i,
      /rateLimiter/i,
      /limiter/i,
      /throttle/i,
      /429/,
    ];

    let missingCount = 0;

    for (const file of paymentRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      // Webhook receivers are called by Stripe, not users - exempt from rate limiting
      if (/webhook/i.test(file)) continue;

      const hasMutation = /export\s+(?:async\s+)?function\s+POST/.test(content);
      if (!hasMutation) continue;

      const hasRateLimit = rateLimitPatterns.some((p) => p.test(content));

      if (!hasRateLimit) {
        missingCount++;
        results.push(
          this.fail('csrf-03', 'HIGH', 'Payment endpoint missing rate limiting', `Payment/checkout endpoint has no rate limiting, risking card testing attacks`, {
            filePath: this.relativePath(file),
            recommendation: 'Add strict rate limiting to payment endpoints (e.g., 5 attempts per minute per IP)',
          })
        );
      }
    }

    if (missingCount === 0) {
      results.push(this.pass('csrf-03', 'Payment endpoints have rate limiting'));
    }

    return results;
  }

  /**
   * csrf-04: Contact/form endpoints should have rate limiting (spam prevention)
   */
  private checkRateLimiterOnContactEndpoints(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiDir = path.join(this.srcDir, 'app', 'api');
    const allRoutes = this.findFiles(apiDir, /^route\.ts$/);

    const contactRoutes = allRoutes.filter((f) =>
      /contact|feedback|newsletter|subscribe|comment|review|message|support/i.test(f)
    );

    if (contactRoutes.length === 0) {
      results.push(this.pass('csrf-04', 'Contact/form rate limiting (no contact routes found)'));
      return results;
    }

    const rateLimitPatterns = [
      /rateLimit/i,
      /rateLimiter/i,
      /limiter/i,
      /throttle/i,
      /captcha/i,
      /recaptcha/i,
      /hcaptcha/i,
      /turnstile/i,
      /429/,
    ];

    let missingCount = 0;

    for (const file of contactRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      const hasMutation = /export\s+(?:async\s+)?function\s+POST/.test(content);
      if (!hasMutation) continue;

      const hasProtection = rateLimitPatterns.some((p) => p.test(content));

      if (!hasProtection) {
        missingCount++;
        results.push(
          this.fail('csrf-04', 'MEDIUM', 'Contact/form endpoint missing rate limiting', `Public form endpoint has no rate limiting or CAPTCHA, enabling spam`, {
            filePath: this.relativePath(file),
            recommendation: 'Add rate limiting or CAPTCHA verification to public form endpoints',
          })
        );
      }
    }

    if (missingCount === 0) {
      results.push(this.pass('csrf-04', 'Contact/form endpoints have rate limiting or CAPTCHA'));
    }

    return results;
  }

  /**
   * csrf-05: Verify rate limiter infrastructure exists in the project
   */
  private checkRateLimiterInfrastructure(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Check for rate limiter utility/library file
    const libFiles = this.findFiles(path.join(this.srcDir, 'lib'), /\.ts$/);
    let hasRateLimiterLib = false;
    let rateLimiterFile = '';

    for (const file of libFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      if (
        /export\s+(?:async\s+)?function\s+(?:rateLimit|rateLimiter|checkRateLimit|withRateLimit)/i.test(content) ||
        /class\s+RateLimiter/i.test(content) ||
        /Ratelimit/i.test(content)
      ) {
        hasRateLimiterLib = true;
        rateLimiterFile = this.relativePath(file);
        break;
      }
    }

    // Also check package.json for rate limit packages
    const packageJson = this.readFile(path.join(this.rootDir, 'package.json'));
    const hasRateLimitPackage = /@upstash\/ratelimit|express-rate-limit|rate-limiter-flexible|bottleneck|p-throttle/i.test(packageJson);

    // Check for Redis or in-memory store for rate limiting
    const hasRedis = /redis|ioredis|@upstash\/redis/i.test(packageJson);

    if (hasRateLimiterLib) {
      results.push(this.pass('csrf-05', `Rate limiter infrastructure exists (${rateLimiterFile})`));
    } else if (hasRateLimitPackage) {
      results.push(this.pass('csrf-05', 'Rate limiter package installed in dependencies'));
    } else {
      results.push(
        this.fail('csrf-05', 'HIGH', 'No rate limiter infrastructure found', 'No rate limiter utility or package detected in the project. Rate limiting requires a shared infrastructure (Redis, in-memory store, or Upstash).', {
          recommendation: 'Install @upstash/ratelimit (with Redis) or implement a rate limiter in src/lib/rate-limiter.ts. Redis is recommended for production use across multiple instances.',
        })
      );
    }

    return results;
  }
}
