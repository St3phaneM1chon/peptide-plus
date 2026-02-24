/**
 * AUTH-SESSION Auditor
 * Verifies authentication guards on admin routes and session configuration security.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class AuthSessionAuditor extends BaseAuditor {
  auditTypeCode = 'AUTH-SESSION';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkAdminRoutesAuth());
    results.push(...this.checkAuthConfigCookieFlags());
    results.push(...this.checkSessionExpiry());
    results.push(...this.checkSessionSecretStrength());
    results.push(...this.checkCsrfProtection());
    results.push(...this.checkCallbackUrlValidation());

    return results;
  }

  /**
   * auth-01: Every /api/admin/ route must call auth(), getServerSession(), or withAdminGuard
   */
  private checkAdminRoutesAuth(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const adminDir = path.join(this.srcDir, 'app', 'api', 'admin');
    const routeFiles = this.findFiles(adminDir, /^route\.ts$/);

    if (routeFiles.length === 0) {
      results.push(this.pass('auth-01', 'Admin route auth guards (no admin routes found)'));
      return results;
    }

    const authPatterns = [
      /auth\s*\(/,
      /getServerSession\s*\(/,
      /withAdminGuard/,
      /requireAdmin/,
      /requireAuth/,
      /getSession\s*\(/,
    ];

    let unprotectedCount = 0;

    for (const file of routeFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const hasAuth = authPatterns.some((pattern) => pattern.test(content));

      if (!hasAuth) {
        unprotectedCount++;
        results.push(
          this.fail('auth-01', 'CRITICAL', 'Admin route missing auth guard', `Route has no authentication check (auth(), getServerSession(), withAdminGuard)`, {
            filePath: this.relativePath(file),
            recommendation: 'Add auth() or withAdminGuard() call at the top of each handler',
          })
        );
      }
    }

    if (unprotectedCount === 0) {
      results.push(this.pass('auth-01', `All ${routeFiles.length} admin routes have auth guards`));
    }

    return results;
  }

  /**
   * auth-02: Cookie flags (httpOnly, secure, sameSite) in auth config
   */
  private checkAuthConfigCookieFlags(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const authConfigPaths = [
      path.join(this.srcDir, 'lib', 'auth-config.ts'),
      path.join(this.srcDir, 'lib', 'auth.ts'),
      path.join(this.srcDir, 'app', 'api', 'auth', '[...nextauth]', 'route.ts'),
      path.join(this.srcDir, 'auth.ts'),
    ];

    let configContent = '';
    let configFile = '';
    for (const p of authConfigPaths) {
      const content = this.readFile(p);
      if (content) {
        configContent = content;
        configFile = p;
        break;
      }
    }

    if (!configContent) {
      results.push(
        this.fail('auth-02', 'HIGH', 'Auth config not found', 'Could not locate auth configuration file (auth-config.ts, auth.ts, or [...nextauth]/route.ts)', {
          recommendation: 'Ensure auth configuration exists in src/lib/auth-config.ts or src/auth.ts',
        })
      );
      return results;
    }

    const relPath = this.relativePath(configFile);

    // Check httpOnly
    if (/httpOnly\s*:\s*true/.test(configContent)) {
      results.push(this.pass('auth-02', 'Session cookie has httpOnly flag'));
    } else {
      results.push(
        this.fail('auth-02', 'HIGH', 'Session cookie missing httpOnly flag', 'Session cookies should have httpOnly: true to prevent XSS-based session theft', {
          filePath: relPath,
          recommendation: 'Set cookies.sessionToken.options.httpOnly = true in auth config',
        })
      );
    }

    // Check secure flag
    if (/secure\s*:\s*true/.test(configContent) || /secure\s*:\s*process\.env\.NODE_ENV\s*===?\s*['"]production['"]/.test(configContent)) {
      results.push(this.pass('auth-03', 'Session cookie has secure flag'));
    } else {
      results.push(
        this.fail('auth-03', 'HIGH', 'Session cookie missing secure flag', 'Session cookies should have secure: true in production to enforce HTTPS-only transmission', {
          filePath: relPath,
          recommendation: 'Set cookies.sessionToken.options.secure = true (or conditionally for production)',
        })
      );
    }

    // Check sameSite
    if (/sameSite\s*:\s*['"](?:lax|strict)['"]/i.test(configContent)) {
      results.push(this.pass('auth-04', 'Session cookie has sameSite attribute'));
    } else {
      results.push(
        this.fail('auth-04', 'MEDIUM', 'Session cookie missing sameSite attribute', 'Session cookies should have sameSite: "lax" or "strict" to mitigate CSRF attacks', {
          filePath: relPath,
          recommendation: 'Set cookies.sessionToken.options.sameSite = "lax" in auth config',
        })
      );
    }

    return results;
  }

  /**
   * auth-05: Session expiry / maxAge configuration
   */
  private checkSessionExpiry(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const authFiles = this.findFiles(this.srcDir, /auth[-.]config\.ts$|auth\.ts$/);

    let found = false;
    for (const file of authFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Look for session maxAge or jwt maxAge
      const maxAgeMatch = content.match(/maxAge\s*:\s*(\d+)/);
      if (maxAgeMatch) {
        found = true;
        const maxAgeSec = parseInt(maxAgeMatch[1], 10);
        const maxAgeHours = maxAgeSec / 3600;

        if (maxAgeHours > 24 * 30) {
          results.push(
            this.fail('auth-05', 'MEDIUM', 'Session maxAge exceeds 30 days', `Session maxAge is set to ${maxAgeHours.toFixed(0)} hours (${(maxAgeHours / 24).toFixed(0)} days). Consider shorter sessions.`, {
              filePath: this.relativePath(file),
              lineNumber: this.findLineNumber(content, 'maxAge'),
              recommendation: 'Set session maxAge to 24 hours or less for sensitive applications, or 7-30 days for e-commerce',
            })
          );
        } else {
          results.push(this.pass('auth-05', `Session maxAge is ${maxAgeHours.toFixed(0)} hours - acceptable`));
        }
      }
    }

    if (!found) {
      results.push(
        this.fail('auth-05', 'MEDIUM', 'No session expiry configured', 'No maxAge setting found in auth configuration. Sessions may use default expiry.', {
          recommendation: 'Explicitly configure session maxAge in auth config',
        })
      );
    }

    return results;
  }

  /**
   * auth-06: NEXTAUTH_SECRET strength - must be set and not a weak default
   */
  private checkSessionSecretStrength(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Check .env files for NEXTAUTH_SECRET or AUTH_SECRET
    const envFiles = [
      path.join(this.rootDir, '.env'),
      path.join(this.rootDir, '.env.local'),
      path.join(this.rootDir, '.env.production'),
    ];

    let secretFound = false;
    for (const envFile of envFiles) {
      const content = this.readFile(envFile);
      if (!content) continue;

      const secretMatch = content.match(/(?:NEXTAUTH_SECRET|AUTH_SECRET)\s*=\s*["']?(.+?)["']?\s*$/m);
      if (secretMatch) {
        secretFound = true;
        const secret = secretMatch[1];

        const weakSecrets = ['secret', 'changeme', 'password', 'test', 'development', '12345'];
        if (weakSecrets.includes(secret.toLowerCase()) || secret.length < 32) {
          results.push(
            this.fail('auth-06', 'CRITICAL', 'Weak NEXTAUTH_SECRET detected', `The auth secret in ${path.basename(envFile)} appears weak (${secret.length < 32 ? 'less than 32 chars' : 'common default value'})`, {
              filePath: this.relativePath(envFile),
              recommendation: 'Generate a strong secret: openssl rand -base64 32',
            })
          );
        } else {
          results.push(this.pass('auth-06', 'Auth secret appears sufficiently strong'));
        }
      }
    }

    if (!secretFound) {
      // Check if referenced in code at least
      const authFiles = this.findFiles(this.srcDir, /auth[-.]config\.ts$|auth\.ts$/);
      const referenced = authFiles.some((f) => {
        const c = this.readFile(f);
        return /NEXTAUTH_SECRET|AUTH_SECRET/.test(c);
      });

      if (referenced) {
        results.push(this.pass('auth-06', 'Auth secret referenced in code (not in committed env files - good)'));
      } else {
        results.push(
          this.fail('auth-06', 'HIGH', 'No auth secret configuration found', 'No NEXTAUTH_SECRET or AUTH_SECRET found in env files or auth config', {
            recommendation: 'Ensure NEXTAUTH_SECRET is set in environment variables',
          })
        );
      }
    }

    return results;
  }

  /**
   * auth-07 (reported as csrf check within auth): Check that auth endpoints validate CSRF
   */
  private checkCsrfProtection(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const authApiDir = path.join(this.srcDir, 'app', 'api', 'auth');
    const authRoutes = this.findFiles(authApiDir, /^route\.ts$/);

    if (authRoutes.length === 0) {
      results.push(this.pass('auth-07', 'Auth CSRF check (no custom auth routes found)'));
      return results;
    }

    // NextAuth handles CSRF internally, but custom auth routes need checking
    // Pre-authentication routes (signup, forgot-password, reset-password) are exempt
    // because the user has no session yet, making CSRF tokens impractical.
    // These routes rely on rate limiting for abuse prevention instead.
    const preAuthExemptPaths = [
      'signup',
      'forgot-password',
      'reset-password',
    ];

    let customRoutesWithoutCsrf = 0;
    for (const file of authRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      // Skip NextAuth catch-all route
      if (file.includes('[...nextauth]')) continue;

      // Skip pre-authentication routes (no session = CSRF tokens impractical)
      const isPreAuth = preAuthExemptPaths.some((p) => file.includes(path.sep + p + path.sep) || file.includes('/' + p + '/'));
      if (isPreAuth) continue;

      const hasMutationHandler = /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)/.test(content);
      if (!hasMutationHandler) continue;

      const hasCsrf = /validateCsrf|csrfToken|withAdminGuard|getCsrfToken/.test(content);
      if (!hasCsrf) {
        customRoutesWithoutCsrf++;
        results.push(
          this.fail('auth-07', 'MEDIUM', 'Custom auth route missing CSRF validation', 'Mutation endpoint in auth API does not validate CSRF tokens', {
            filePath: this.relativePath(file),
            recommendation: 'Add CSRF token validation to custom auth mutation endpoints',
          })
        );
      }
    }

    if (customRoutesWithoutCsrf === 0) {
      results.push(this.pass('auth-07', 'Auth endpoints have CSRF protection'));
    }

    return results;
  }

  /**
   * auth-07b: Callback URL validation - check for open redirect in auth callbacks
   */
  private checkCallbackUrlValidation(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const authFiles = [
      ...this.findFiles(path.join(this.srcDir, 'app', 'api', 'auth'), /\.ts$/),
      ...this.findFiles(this.srcDir, /auth[-.]config\.ts$/),
    ];

    let hasCallbackUrl = false;
    let hasValidation = false;

    for (const file of authFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      if (/callbackUrl|redirect/.test(content)) {
        hasCallbackUrl = true;
      }

      // Check for redirect validation patterns (including NextAuth redirect callback)
      if (
        /callbackUrl\.startsWith\s*\(\s*['"]\/['"]/.test(content) ||
        /allowedRedirects|isValidCallbackUrl/.test(content) ||
        /redirect.*\.startsWith/.test(content) ||
        /url\.startsWith\s*\(\s*['"]\/['"]\s*\)/.test(content) ||
        /redirect\s*\(\s*\{[^}]*url[^}]*baseUrl/.test(content)
      ) {
        hasValidation = true;
      }
    }

    if (!hasCallbackUrl) {
      results.push(this.pass('auth-07b', 'No callback URL handling found (low risk)'));
    } else if (hasValidation) {
      results.push(this.pass('auth-07b', 'Callback URL validation detected'));
    } else {
      results.push(
        this.fail('auth-07b', 'MEDIUM', 'Callback URL may lack validation', 'Auth flow uses callbackUrl/redirect without visible URL validation, risking open redirect', {
          recommendation: 'Validate callback URLs start with "/" or match allowed origins to prevent open redirect',
        })
      );
    }

    return results;
  }
}
