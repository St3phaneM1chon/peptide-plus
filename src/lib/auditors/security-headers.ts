/**
 * SECURITY-HEADERS Auditor
 * Checks for essential HTTP security headers: CSP, X-Frame-Options,
 * X-Content-Type-Options, Referrer-Policy, HSTS, and Permissions-Policy.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class SecurityHeadersAuditor extends BaseAuditor {
  auditTypeCode = 'SECURITY-HEADERS';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    // Load all files where security headers could be configured
    const headerSources = this.loadHeaderSources();

    results.push(...this.checkCsp(headerSources));
    results.push(...this.checkXFrameOptions(headerSources));
    results.push(...this.checkXContentTypeOptions(headerSources));
    results.push(...this.checkReferrerPolicy(headerSources));
    results.push(...this.checkHsts(headerSources));
    results.push(...this.checkPermissionsPolicy(headerSources));

    return results;
  }

  /** Load content from all files where headers could be configured */
  private loadHeaderSources(): { file: string; content: string }[] {
    const sources: { file: string; content: string }[] = [];

    // next.config.js / next.config.mjs / next.config.ts
    const nextConfigFiles = [
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
    ];
    for (const name of nextConfigFiles) {
      const filePath = path.join(this.rootDir, name);
      const content = this.readFile(filePath);
      if (content) {
        sources.push({ file: this.relativePath(filePath), content });
      }
    }

    // middleware.ts / middleware.js
    const middlewareFiles = [
      path.join(this.srcDir, 'middleware.ts'),
      path.join(this.srcDir, 'middleware.js'),
      path.join(this.rootDir, 'middleware.ts'),
      path.join(this.rootDir, 'middleware.js'),
    ];
    for (const filePath of middlewareFiles) {
      const content = this.readFile(filePath);
      if (content) {
        sources.push({ file: this.relativePath(filePath), content });
      }
    }

    // vercel.json (for header configuration)
    const vercelJson = path.join(this.rootDir, 'vercel.json');
    const vercelContent = this.readFile(vercelJson);
    if (vercelContent) {
      sources.push({ file: 'vercel.json', content: vercelContent });
    }

    // Custom header utility files
    const headerLibFiles = this.findFiles(
      path.join(this.srcDir, 'lib'),
      /header|security|csp/i
    );
    for (const filePath of headerLibFiles) {
      const content = this.readFile(filePath);
      if (content) {
        sources.push({ file: this.relativePath(filePath), content });
      }
    }

    return sources;
  }

  /** Check if any source contains a pattern */
  private sourceContains(
    sources: { file: string; content: string }[],
    patterns: RegExp[]
  ): { found: boolean; file?: string; lineNum?: number; snippet?: string } {
    for (const { file, content } of sources) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          const match = content.match(pattern);
          if (match) {
            const lineNum = this.findLineNumber(content, match[0]);
            return {
              found: true,
              file,
              lineNum,
              snippet: this.getSnippet(content, lineNum),
            };
          }
        }
      }
    }
    return { found: false };
  }

  /**
   * headers-01: Check for Content-Security-Policy header
   */
  private checkCsp(sources: { file: string; content: string }[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const cspResult = this.sourceContains(sources, [
      /Content-Security-Policy/i,
      /contentSecurityPolicy/i,
      /csp/i,
    ]);

    if (!cspResult.found) {
      results.push(
        this.fail('headers-01', 'HIGH', 'Missing Content-Security-Policy header', 'No Content-Security-Policy (CSP) header configuration found in next.config, middleware, or vercel.json. CSP prevents XSS attacks by controlling which resources the browser can load.', {
          recommendation:
            'Add a CSP header in next.config.js headers() or middleware.ts. Start with a restrictive policy and loosen as needed: `"default-src \'self\'; script-src \'self\' \'unsafe-inline\';"`. Use report-uri for monitoring violations.',
        })
      );
    } else {
      // Check for unsafe-inline and unsafe-eval in CSP
      const cspSource = sources.find((s) =>
        /Content-Security-Policy|contentSecurityPolicy|csp/i.test(s.content)
      );
      if (cspSource) {
        const hasUnsafeEval = /unsafe-eval/.test(cspSource.content);
        // Check if unsafe-eval is conditionally applied only in development
        const isConditionalDev = /NODE_ENV.*production[\s\S]{0,300}unsafe-eval/s.test(cspSource.content)
          || /development[\s\S]{0,100}unsafe-eval/s.test(cspSource.content);
        if (hasUnsafeEval && !isConditionalDev) {
          const lineNum = this.findLineNumber(cspSource.content, 'unsafe-eval');
          results.push(
            this.fail('headers-01', 'MEDIUM', 'CSP allows unsafe-eval', 'Content-Security-Policy includes unsafe-eval which weakens XSS protection.', {
              filePath: cspSource.file,
              lineNumber: lineNum,
              codeSnippet: this.getSnippet(cspSource.content, lineNum),
              recommendation:
                'Remove unsafe-eval from CSP if possible. If required by a library, document the reason and restrict it to specific domains.',
            })
          );
        } else if (hasUnsafeEval && isConditionalDev) {
          results.push(this.pass('headers-01', 'CSP uses unsafe-eval only in development mode (acceptable for Next.js HMR)'));
        } else {
          results.push(this.pass('headers-01', 'Content-Security-Policy header configured'));
        }
      } else {
        results.push(this.pass('headers-01', 'Content-Security-Policy header configured'));
      }
    }

    return results;
  }

  /**
   * headers-02: Check for X-Frame-Options header
   */
  private checkXFrameOptions(sources: { file: string; content: string }[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const xfoResult = this.sourceContains(sources, [
      /X-Frame-Options/i,
      /x-frame-options/i,
    ]);

    // Also check CSP frame-ancestors (modern replacement for X-Frame-Options)
    const frameAncestors = this.sourceContains(sources, [
      /frame-ancestors/i,
    ]);

    if (!xfoResult.found && !frameAncestors.found) {
      results.push(
        this.fail('headers-02', 'HIGH', 'Missing X-Frame-Options header', 'No X-Frame-Options or CSP frame-ancestors directive found. The site can be embedded in iframes on any domain, enabling clickjacking attacks.', {
          recommendation:
            'Add X-Frame-Options: DENY or SAMEORIGIN header. Alternatively, use CSP frame-ancestors directive: `frame-ancestors \'self\'`. Configure in next.config.js or middleware.',
        })
      );
    } else {
      results.push(this.pass('headers-02', 'Frame embedding protection configured'));
    }

    return results;
  }

  /**
   * headers-03: Check for X-Content-Type-Options: nosniff
   */
  private checkXContentTypeOptions(sources: { file: string; content: string }[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const xctoResult = this.sourceContains(sources, [
      /X-Content-Type-Options/i,
      /x-content-type-options/i,
      /nosniff/i,
    ]);

    if (!xctoResult.found) {
      results.push(
        this.fail('headers-03', 'MEDIUM', 'Missing X-Content-Type-Options header', 'No X-Content-Type-Options: nosniff header found. Without this header, browsers may MIME-sniff responses, potentially executing uploaded files as scripts.', {
          recommendation:
            'Add `X-Content-Type-Options: nosniff` header in next.config.js or middleware. This prevents browsers from interpreting files as a different MIME type.',
        })
      );
    } else {
      results.push(
        this.pass('headers-03', 'X-Content-Type-Options header configured')
      );
    }

    return results;
  }

  /**
   * headers-04: Check for Referrer-Policy header
   */
  private checkReferrerPolicy(sources: { file: string; content: string }[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const rpResult = this.sourceContains(sources, [
      /Referrer-Policy/i,
      /referrer-policy/i,
      /referrerPolicy/i,
    ]);

    if (!rpResult.found) {
      results.push(
        this.fail('headers-04', 'MEDIUM', 'Missing Referrer-Policy header', 'No Referrer-Policy header found. Without it, the full URL (including query parameters with potential sensitive data) may be sent to external sites when users click links.', {
          recommendation:
            'Add `Referrer-Policy: strict-origin-when-cross-origin` or `no-referrer-when-downgrade` header. This prevents leaking URL paths and query parameters to external sites.',
        })
      );
    } else {
      results.push(this.pass('headers-04', 'Referrer-Policy header configured'));
    }

    return results;
  }

  /**
   * headers-05: Check for Strict-Transport-Security (HSTS)
   */
  private checkHsts(sources: { file: string; content: string }[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const hstsResult = this.sourceContains(sources, [
      /Strict-Transport-Security/i,
      /strict-transport-security/i,
    ]);

    if (!hstsResult.found) {
      results.push(
        this.fail('headers-05', 'HIGH', 'Missing Strict-Transport-Security header', 'No HSTS header found. Without HSTS, users can be downgraded to HTTP connections, exposing session cookies and credentials to man-in-the-middle attacks.', {
          recommendation:
            'Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` header. Start with a shorter max-age for testing, then increase to 1 year (31536000). Consider HSTS preloading.',
        })
      );
    } else {
      // Check for adequate max-age
      const hstsSource = sources.find((s) =>
        /Strict-Transport-Security|strict-transport-security/i.test(s.content)
      );
      if (hstsSource) {
        const maxAgeMatch = hstsSource.content.match(/max-age=(\d+)/);
        if (maxAgeMatch) {
          const maxAge = parseInt(maxAgeMatch[1], 10);
          if (maxAge < 15768000) {
            // Less than 6 months
            results.push(
              this.fail('headers-05', 'LOW', 'HSTS max-age is short', `HSTS max-age is ${maxAge} seconds (${Math.round(maxAge / 86400)} days). Recommended minimum is 6 months (15768000 seconds), ideally 1 year.`, {
                filePath: hstsSource.file,
                recommendation:
                  'Increase HSTS max-age to at least 15768000 (6 months), preferably 31536000 (1 year).',
              })
            );
          } else {
            results.push(
              this.pass('headers-05', 'Strict-Transport-Security header configured')
            );
          }
        } else {
          results.push(
            this.pass('headers-05', 'Strict-Transport-Security header configured')
          );
        }
      }
    }

    return results;
  }

  /**
   * headers-06: Check for Permissions-Policy header
   */
  private checkPermissionsPolicy(sources: { file: string; content: string }[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const ppResult = this.sourceContains(sources, [
      /Permissions-Policy/i,
      /permissions-policy/i,
      /Feature-Policy/i,
      /feature-policy/i,
    ]);

    if (!ppResult.found) {
      results.push(
        this.fail('headers-06', 'LOW', 'Missing Permissions-Policy header', 'No Permissions-Policy header found. This header controls which browser features (camera, microphone, geolocation, payment) the site can use, reducing attack surface.', {
          recommendation:
            'Add a Permissions-Policy header disabling unused browser APIs: `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)`. Only enable features the application actually uses.',
        })
      );
    } else {
      results.push(
        this.pass('headers-06', 'Permissions-Policy header configured')
      );
    }

    return results;
  }
}
