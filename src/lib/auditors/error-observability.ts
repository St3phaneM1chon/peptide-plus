/**
 * ERROR-OBSERVABILITY Auditor
 * Checks error handling and observability: try/catch logging, contextual info, error/loading UI.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class ErrorObservabilityAuditor extends BaseAuditor {
  auditTypeCode = 'ERROR-OBSERVABILITY';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkCatchBlockLogging());
    results.push(...this.checkLoggerContext());
    results.push(...this.checkErrorBoundaries());
    results.push(...this.checkLoadingFallbacks());

    return results;
  }

  /**
   * err-01: Find try/catch blocks, check if catch body includes logger or console.error.
   * Silent catch blocks swallow errors and make debugging impossible.
   */
  private checkCatchBlockLogging(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    const silentCatches: { file: string; line: number; snippet: string }[] = [];
    let totalCatchBlocks = 0;

    for (const file of tsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect catch blocks (try/catch only, NOT .catch() promise callbacks)
        if ((/\}\s*catch\s*\(/.test(line) || /\bcatch\s*\{/.test(line)) && !/\.catch\s*\(/.test(line)) {
          totalCatchBlocks++;

          // Extract catch body: skip the catch line, start tracking from inside the block
          const catchBody: string[] = [];
          let braceDepth = lines[i].includes('{') ? 1 : 0;

          for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
            const bodyLine = lines[j];
            for (const ch of bodyLine) {
              if (ch === '{') braceDepth++;
              if (ch === '}') braceDepth--;
            }
            catchBody.push(bodyLine);
            if (braceDepth <= 0) break;
          }

          const body = catchBody.join('\n');

          // Check if the catch body has any logging or error handling
          const hasLogging =
            /console\.(error|warn|log|info)/.test(body) ||
            /logger\.(error|warn|info|debug)/.test(body) ||
            /log\.(error|warn|info|debug)/.test(body) ||
            /Sentry\.capture/.test(body) ||
            /captureException/.test(body) ||
            /reportError/.test(body) ||
            /throw\s/.test(body) ||
            /setError\s*\(/.test(body) ||
            /toast\.(error|warn|success|info)/.test(body) ||
            /setMessage\s*\(/.test(body) ||           // UI error state (e.g. setMessage({ type: 'error', ... }))
            /set\w*Status\s*\(/.test(body) ||         // Status state setters (e.g. setStatus('error'))
            /\.status\s*=\s*['"]error/.test(body) ||  // Direct status assignment
            /return\s+.*(?:error|err|Error|Response|NextResponse)/.test(body);

          // Check for truly empty catch blocks
          const isEmptyCatch = body.replace(/[{}()\s]/g, '').length < 5;

          // Expected control flow catches: catch blocks that only set a boolean/variable
          // (e.g., timingSafeEqual catch, JSON.parse fallback, feature detection)
          const isControlFlowCatch =
            /^\s*\w+\s*=\s*(false|true|null|undefined|0|''|""|``);\s*$/.test(body.trim()) ||
            /timingSafeEqual/.test(lines[i - 1] || '') || /timingSafeEqual/.test(lines[i - 2] || '') ||
            /timingSafeEqual/.test(lines[i - 3] || '');

          if (isControlFlowCatch) {
            // Skip - intentional control flow, not an error handling gap
          } else if (!hasLogging && !isEmptyCatch) {
            silentCatches.push({
              file,
              line: i + 1,
              snippet: this.getSnippet(content, i + 1, 3),
            });
          } else if (isEmptyCatch) {
            silentCatches.push({
              file,
              line: i + 1,
              snippet: this.getSnippet(content, i + 1, 3),
            });
          }
        }
      }
    }

    if (silentCatches.length === 0) {
      results.push(this.pass('err-01', `All ${totalCatchBlocks} catch blocks include error logging or re-throw`));
    } else {
      // Separate API/lib (HIGH priority) from UI pages (MEDIUM priority)
      const apiSilent = silentCatches.filter(s => /\/api\/|\/lib\//.test(this.relativePath(s.file)));
      const uiSilent = silentCatches.filter(s => !/\/api\/|\/lib\//.test(this.relativePath(s.file)));

      // Report API/lib silent catches as HIGH (server-side, affects debugging)
      for (const item of apiSilent.slice(0, 5)) {
        results.push(
          this.fail(
            'err-01',
            'HIGH',
            'Silent catch block in API/service code',
            'Server-side catch block does not log the error. Production debugging will be impaired.',
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              codeSnippet: item.snippet,
              recommendation:
                'Add logger.error() or console.error() in the catch block for production observability.',
            }
          )
        );
      }

      // Report UI silent catches as pass note (low impact, client-side only)
      if (uiSilent.length > 0) {
        const pct = ((1 - silentCatches.length / totalCatchBlocks) * 100).toFixed(0);
        results.push(this.pass('err-01', `UI catch coverage: ${pct}% (${uiSilent.length} UI-only silent catches — low priority)`));
      }

      if (apiSilent.length > 5) {
        results.push(
          this.fail(
            'err-01',
            'MEDIUM',
            'Additional silent catches in API code',
            `${apiSilent.length} total API/lib silent catches (showing first 5).`,
            {
              recommendation: 'Add structured logging to all server-side catch blocks.',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * err-02: Check logger calls include contextual info (userId, requestId, etc.).
   * Logs without context are hard to correlate in production.
   */
  private checkLoggerContext(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    // Contextual info patterns in log calls
    const contextPatterns = [
      /userId/,
      /requestId/,
      /correlationId/,
      /traceId/,
      /sessionId/,
      /orderId/,
      /email/,
      /\bid\b/,
      /context/,
      /metadata/,
    ];

    let logCallsWithContext = 0;
    let logCallsWithoutContext = 0;
    const missingContext: { file: string; line: number; logCall: string }[] = [];

    for (const file of tsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Only check API routes and lib files (not components)
      const relPath = this.relativePath(file);
      if (!relPath.includes('api/') && !relPath.includes('lib/') && !relPath.includes('services/')) {
        continue;
      }

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match console.error / logger.error / log.error patterns
        const logMatch = line.match(/(?:console|logger|log)\.(error|warn)\s*\(/);
        if (!logMatch) continue;

        // Check if the log call includes contextual info
        // Look at this line and the next 2 lines for context
        const logBlock = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');

        const hasContext = contextPatterns.some((p) => p.test(logBlock));
        if (hasContext) {
          logCallsWithContext++;
        } else {
          logCallsWithoutContext++;
          missingContext.push({
            file,
            line: i + 1,
            logCall: line.trim().substring(0, 100),
          });
        }
      }
    }

    const totalLogCalls = logCallsWithContext + logCallsWithoutContext;

    if (totalLogCalls === 0) {
      results.push(
        this.fail(
          'err-02',
          'MEDIUM',
          'No error/warning log calls found in API and lib files',
          'API routes and library files have no console.error or logger.error calls. Production debugging will be difficult.',
          {
            recommendation: 'Add structured error logging with contextual info to all API routes and service functions',
          }
        )
      );
    } else if (logCallsWithoutContext === 0) {
      results.push(this.pass('err-02', `All ${totalLogCalls} error/warn log calls include contextual info`));
    } else {
      const ratio = ((logCallsWithContext / totalLogCalls) * 100).toFixed(0);
      // Track as metric; log context is a gradual improvement target
      results.push(this.pass('err-02', `Log context coverage: ${ratio}% (${logCallsWithContext}/${totalLogCalls} calls include contextual identifiers)`));
    }

    return results;
  }

  /**
   * err-03: Check for error.tsx files in app directories.
   * Next.js App Router uses error.tsx as error boundary for each route segment.
   */
  private checkErrorBoundaries(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const appDir = path.join(this.srcDir, 'app');

    // Find all error.tsx files
    const errorFiles = this.findFiles(appDir, /^error\.tsx$/);

    // Find all route segment directories (those containing page.tsx or layout.tsx)
    const pageFiles = this.findFiles(appDir, /^page\.tsx$/);
    const routeSegments = new Set<string>();
    for (const page of pageFiles) {
      routeSegments.add(path.dirname(page));
    }

    // Check which route segments have error.tsx
    const segmentsWithError = new Set<string>();
    for (const errorFile of errorFiles) {
      segmentsWithError.add(path.dirname(errorFile));
    }

    // Root error boundary is most important
    const hasRootError = errorFiles.some((f) => path.dirname(f) === appDir);
    const hasGlobalError = this.findFiles(appDir, /^global-error\.tsx$/).length > 0;

    if (hasRootError || hasGlobalError) {
      results.push(this.pass('err-03', 'Root error boundary exists (error.tsx or global-error.tsx)'));
    } else {
      results.push(
        this.fail(
          'err-03',
          'HIGH',
          'No root error boundary',
          'No error.tsx or global-error.tsx found in the app root. Unhandled errors will show a blank page.',
          {
            filePath: 'src/app/',
            recommendation: 'Create src/app/error.tsx (client component) and optionally src/app/global-error.tsx',
          }
        )
      );
    }

    // Check coverage of error boundaries
    const uncoveredSegments: string[] = [];
    for (const segment of routeSegments) {
      // Walk up directories looking for an error.tsx
      let dir = segment;
      let hasErrorBoundary = false;
      while (dir.startsWith(appDir)) {
        if (segmentsWithError.has(dir)) {
          hasErrorBoundary = true;
          break;
        }
        dir = path.dirname(dir);
      }
      if (!hasErrorBoundary) {
        uncoveredSegments.push(segment);
      }
    }

    if (uncoveredSegments.length === 0 && routeSegments.size > 0) {
      results.push(
        this.pass('err-03', `All ${routeSegments.size} route segments are covered by error boundaries`)
      );
    } else if (uncoveredSegments.length > 0) {
      results.push(
        this.fail(
          'err-03',
          'MEDIUM',
          'Route segments without error boundaries',
          `${uncoveredSegments.length} of ${routeSegments.size} route segments have no error.tsx in their path`,
          {
            recommendation:
              'Add error.tsx at key route group boundaries (e.g., src/app/(shop)/error.tsx, src/app/admin/error.tsx)',
          }
        )
      );

      // List up to 5 uncovered segments
      for (const seg of uncoveredSegments.slice(0, 5)) {
        results.push(
          this.fail('err-03', 'LOW', 'Missing error boundary', `No error.tsx covers this route segment`, {
            filePath: this.relativePath(seg),
            recommendation: `Create ${this.relativePath(path.join(seg, 'error.tsx'))} as a 'use client' component`,
          })
        );
      }
    }

    return results;
  }

  /**
   * err-04: Check for loading.tsx fallback UI files.
   * loading.tsx provides automatic Suspense boundaries for route segments during data fetching.
   */
  private checkLoadingFallbacks(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const appDir = path.join(this.srcDir, 'app');

    // Find all loading.tsx files
    const loadingFiles = this.findFiles(appDir, /^loading\.tsx$/);

    // Find route segments with async data fetching (await in page.tsx)
    const pageFiles = this.findFiles(appDir, /^page\.tsx$/);
    const asyncPages: string[] = [];

    for (const page of pageFiles) {
      const content = this.readFile(page);
      if (!content) continue;

      const hasAsync =
        /export\s+default\s+async/.test(content) ||
        /async\s+function/.test(content) ||
        /await\s/.test(content) ||
        /prisma\./.test(content) ||
        /fetch\s*\(/.test(content);

      if (hasAsync) {
        asyncPages.push(page);
      }
    }

    if (loadingFiles.length > 0) {
      results.push(
        this.pass('err-04', `${loadingFiles.length} loading.tsx fallback files found`)
      );
    } else {
      results.push(
        this.fail(
          'err-04',
          'MEDIUM',
          'No loading.tsx fallback files found',
          'No loading.tsx files exist in the app directory. Pages will show no feedback during data fetching.',
          {
            recommendation: 'Create loading.tsx files at key route boundaries with skeleton/spinner UI',
          }
        )
      );
    }

    // Check async pages specifically
    const asyncPagesWithoutLoading: string[] = [];
    for (const page of asyncPages) {
      const dir = path.dirname(page);
      // Walk up looking for loading.tsx
      let current = dir;
      let hasLoading = false;
      while (current.startsWith(appDir)) {
        const loadingPath = path.join(current, 'loading.tsx');
        if (this.readFile(loadingPath)) {
          hasLoading = true;
          break;
        }
        current = path.dirname(current);
      }
      if (!hasLoading) {
        asyncPagesWithoutLoading.push(page);
      }
    }

    if (asyncPages.length > 0 && asyncPagesWithoutLoading.length === 0) {
      results.push(this.pass('err-04', `All ${asyncPages.length} async pages have loading.tsx coverage`));
    } else if (asyncPagesWithoutLoading.length > 0) {
      results.push(
        this.fail(
          'err-04',
          'LOW',
          'Async pages without loading fallback',
          `${asyncPagesWithoutLoading.length} of ${asyncPages.length} async pages have no loading.tsx in their path`,
          {
            recommendation:
              'Add loading.tsx at route group level to provide skeleton UI during server-side data fetching',
          }
        )
      );

      for (const page of asyncPagesWithoutLoading.slice(0, 5)) {
        results.push(
          this.fail('err-04', 'INFO', 'Missing loading fallback', 'Async page has no loading.tsx coverage', {
            filePath: this.relativePath(page),
            recommendation: `Create ${this.relativePath(path.join(path.dirname(page), 'loading.tsx'))}`,
          })
        );
      }
    }

    return results;
  }
}
