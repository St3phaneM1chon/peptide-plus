/**
 * CRON-RELIABILITY Auditor
 * Checks cron/scheduled jobs for error handling, retry logic,
 * overlap prevention, and timeout handling.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class CronReliabilityAuditor extends BaseAuditor {
  auditTypeCode = 'CRON-RELIABILITY';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    const cronFiles = this.findCronFiles();

    results.push(...this.checkTryCatch(cronFiles));
    results.push(...this.checkRetryLogic(cronFiles));
    results.push(...this.checkOverlapPrevention(cronFiles));
    results.push(...this.checkTimeoutHandling(cronFiles));

    return results;
  }

  /** Find cron/scheduled job files */
  private findCronFiles(): string[] {
    const cronFiles: string[] = [];

    // Check common locations for cron/scheduled jobs
    const searchDirs = [
      `${this.srcDir}/app/api/cron`,
      `${this.srcDir}/app/api/jobs`,
      `${this.srcDir}/app/api/scheduled`,
      `${this.srcDir}/app/api/tasks`,
      `${this.srcDir}/lib/cron`,
      `${this.srcDir}/lib/jobs`,
      `${this.srcDir}/lib/tasks`,
      `${this.srcDir}/lib/workers`,
      `${this.srcDir}/workers`,
      `${this.rootDir}/scripts`,
      `${this.rootDir}/jobs`,
      `${this.rootDir}/cron`,
    ];

    for (const dir of searchDirs) {
      const files = this.findFiles(dir, /\.(ts|js)$/);
      for (const file of files) {
        // In the scripts/ directory, only include files that look like scheduled/cron jobs
        // Skip one-off admin/dev scripts (migrations, seed, populate, fix-*, check-*, etc.)
        if (dir.endsWith('/scripts')) {
          const name = file.split('/').pop()?.toLowerCase() || '';
          if (/^(fix-|check-|migrate-|seed|populate|get-|download-|run-|audit-)/.test(name)) continue;
          // Only include if filename suggests scheduling: cron, schedule, daily, weekly, hourly, nightly
          if (!/cron|schedule|daily|weekly|hourly|nightly|recurring|worker|job/i.test(name)) continue;
        }
        cronFiles.push(file);
      }
    }

    // Also check API routes that look like cron endpoints
    const apiFiles = this.findApiRoutes();
    for (const file of apiFiles) {
      if (/cron|job|schedule|task|worker/i.test(file)) {
        if (!cronFiles.includes(file)) {
          cronFiles.push(file);
        }
        continue;
      }

      const content = this.readFile(file);
      if (!content) continue;

      // Check for cron-related patterns in API routes
      const cronPatterns = [
        /cron/i,
        /scheduled/i,
        /CRON_SECRET/,
        /vercel.*cron/i,
        /next-cron/i,
        /node-cron/i,
        /agenda\./,
        /bull\./,
        /bullmq/i,
      ];

      if (cronPatterns.some((p) => p.test(content))) {
        if (!cronFiles.includes(file)) {
          cronFiles.push(file);
        }
      }
    }

    return cronFiles;
  }

  /**
   * cron-01: Check cron/scheduled job files for try/catch
   */
  private checkTryCatch(cronFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (cronFiles.length === 0) {
      results.push(
        this.fail('cron-01', 'INFO', 'No cron/scheduled job files found', 'No cron or scheduled job files detected. If the application has background tasks, they may be located in unexpected places.', {
          recommendation:
            'Organize cron jobs under src/app/api/cron/ or src/lib/jobs/ for discoverability.',
        })
      );
      return results;
    }

    let allHaveTryCatch = true;

    for (const file of cronFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const hasTryCatch = /try\s*\{/.test(content) && /catch\s*\(/.test(content);

      if (!hasTryCatch) {
        allHaveTryCatch = false;
        results.push(
          this.fail('cron-01', 'HIGH', 'Cron job missing try/catch', `${this.relativePath(file)} lacks try/catch error handling. Unhandled exceptions in cron jobs fail silently and can leave work incomplete.`, {
            filePath: this.relativePath(file),
            recommendation:
              'Wrap the entire job body in try/catch. In the catch block, log the error with context (job name, timestamp, input params) and send alerts for critical failures.',
          })
        );
      }
    }

    if (allHaveTryCatch) {
      results.push(
        this.pass('cron-01', 'All cron jobs have try/catch error handling')
      );
    }

    return results;
  }

  /**
   * cron-02: Check for retry logic in background jobs
   */
  private checkRetryLogic(cronFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (cronFiles.length === 0) {
      results.push(this.pass('cron-02', 'No cron jobs to check for retry logic'));
      return results;
    }

    let hasRetryLogic = false;

    for (const file of cronFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const retryPatterns = [
        /retry/i,
        /retries/i,
        /maxRetries/i,
        /retryCount/i,
        /attempts?/i,
        /maxAttempts/i,
        /backoff/i,
        /exponentialBackoff/i,
        /setTimeout.*retry/i,
        /while.*attempt/i,
        /for\s*\(.*attempt/i,
      ];

      if (retryPatterns.some((p) => p.test(content))) {
        hasRetryLogic = true;
      }
    }

    if (!hasRetryLogic && cronFiles.length > 0) {
      results.push(
        this.fail('cron-02', 'MEDIUM', 'No retry logic in background jobs', 'None of the cron/job files implement retry logic. Transient failures (network timeouts, DB locks) will cause permanent job failure.', {
          recommendation:
            'Implement retry with exponential backoff for transient failures. Example: attempt up to 3 times with delays of 1s, 4s, 16s. Use a library like `p-retry` or implement manually.',
        })
      );
    } else if (hasRetryLogic) {
      results.push(
        this.pass('cron-02', 'Retry logic found in background jobs')
      );
    }

    return results;
  }

  /**
   * cron-03: Check for overlap prevention (locks, flags)
   */
  private checkOverlapPrevention(cronFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (cronFiles.length === 0) {
      results.push(this.pass('cron-03', 'No cron jobs to check for overlap'));
      return results;
    }

    let hasLocking = false;

    for (const file of cronFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lockPatterns = [
        /lock/i,
        /mutex/i,
        /semaphore/i,
        /isRunning/i,
        /inProgress/i,
        /acquired/i,
        /advisory.*lock/i,
        /pg_advisory_lock/i,
        /SET.*lock/i,
        /redis.*lock/i,
        /setnx/i,
        /SETNX/,
      ];

      if (lockPatterns.some((p) => p.test(content))) {
        hasLocking = true;
      }
    }

    if (!hasLocking && cronFiles.length > 0) {
      results.push(
        this.fail('cron-03', 'MEDIUM', 'No overlap prevention in cron jobs', 'Cron jobs do not implement locking or overlap prevention. If a job takes longer than the cron interval, multiple instances can run simultaneously, causing data corruption.', {
          recommendation:
            'Implement a locking mechanism: use a database flag (e.g., job_locks table), Redis SETNX, or pg_advisory_lock to ensure only one instance runs at a time.',
        })
      );
    } else if (hasLocking) {
      results.push(
        this.pass('cron-03', 'Overlap prevention detected in cron jobs')
      );
    }

    return results;
  }

  /**
   * cron-04: Check for timeout handling
   */
  private checkTimeoutHandling(cronFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (cronFiles.length === 0) {
      results.push(this.pass('cron-04', 'No cron jobs to check for timeouts'));
      return results;
    }

    let hasTimeout = false;

    for (const file of cronFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const timeoutPatterns = [
        /timeout/i,
        /setTimeout/,
        /AbortController/,
        /AbortSignal/,
        /signal.*abort/i,
        /deadline/i,
        /maxDuration/i,
        /maxRuntime/i,
        /Promise\.race/,
        /timeLimit/i,
      ];

      if (timeoutPatterns.some((p) => p.test(content))) {
        hasTimeout = true;
      }
    }

    if (!hasTimeout && cronFiles.length > 0) {
      results.push(
        this.fail('cron-04', 'LOW', 'No timeout handling in cron jobs', 'Cron jobs do not implement timeout handling. A hung job can block the schedule indefinitely and consume resources.', {
          recommendation:
            'Implement timeouts using AbortController/AbortSignal or Promise.race with a timeout promise. Set maximum execution time appropriate for each job type.',
        })
      );
    } else if (hasTimeout) {
      results.push(
        this.pass('cron-04', 'Timeout handling detected in cron jobs')
      );
    }

    return results;
  }
}
