/**
 * HIPAA Audit Log — Compliance-Grade Access Logging for VoIP
 *
 * Features:
 * - Detailed logging of all VoIP access events (recordings, voicemails, etc.)
 * - Buffered writes with configurable flush size and interval
 * - Query with filters (userId, action, date range, resource)
 * - CSV export for compliance audits and reporting
 * - Compliance check: verify all required event types are being logged
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'recording.play'
  | 'recording.download'
  | 'recording.delete'
  | 'voicemail.listen'
  | 'voicemail.delete'
  | 'call.listen'
  | 'call.whisper'
  | 'call.barge'
  | 'transcription.view'
  | 'report.export'
  | 'config.change'
  | 'user.login'
  | 'user.logout';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure' | 'denied';
}

export interface AuditQueryFilters {
  userId?: string;
  action?: AuditAction;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/** All HIPAA-required audit event types that must appear in logs. */
const REQUIRED_AUDIT_EVENTS: AuditAction[] = [
  'recording.play',
  'recording.download',
  'recording.delete',
  'voicemail.listen',
  'voicemail.delete',
  'transcription.view',
  'user.login',
  'user.logout',
];

// ---------------------------------------------------------------------------
// AuditLogger
// ---------------------------------------------------------------------------

export class AuditLogger {
  private buffer: AuditEntry[] = [];
  private flushInterval?: ReturnType<typeof setInterval>;
  private flushSize: number;
  private flushIntervalMs: number;

  constructor(options?: { flushSize?: number; flushIntervalMs?: number }) {
    this.flushSize = options?.flushSize ?? 50;
    this.flushIntervalMs = options?.flushIntervalMs ?? 30_000; // 30s default
  }

  /**
   * Log an audit event.
   * Adds the entry to the buffer and triggers a flush when the
   * buffer reaches the configured flushSize.
   */
  async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    const full: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...entry,
    };

    this.buffer.push(full);

    logger.info('[AuditLog] Event recorded', {
      action: entry.action,
      userId: entry.userId,
      resource: entry.resource,
      result: entry.result,
    });

    // Flush when buffer reaches threshold
    if (this.buffer.length >= this.flushSize) {
      await this.flush();
    }
  }

  /**
   * Flush the buffer to the database.
   * Uses a raw INSERT for performance (batch insert).
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const batch = [...this.buffer];
    this.buffer = [];

    try {
      // Build bulk insert values
      const values = batch.map(entry => ({
        id: entry.id,
        timestamp: entry.timestamp,
        userId: entry.userId,
        userName: entry.userName || null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId || null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        result: entry.result,
      }));

      // Use createMany for efficient batch insert
      await prisma.$executeRaw`
        INSERT INTO "VoipAuditLog" (
          "id", "timestamp", "userId", "userName", "action",
          "resource", "resourceId", "details",
          "ipAddress", "userAgent", "result"
        )
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(values)}::jsonb)
        AS t(
          "id" text, "timestamp" timestamptz, "userId" text, "userName" text, "action" text,
          "resource" text, "resourceId" text, "details" text,
          "ipAddress" text, "userAgent" text, "result" text
        )
      `;

      logger.info('[AuditLog] Flushed to database', { count: batch.length });
    } catch (error) {
      // On failure, put entries back in buffer so they are not lost
      this.buffer.unshift(...batch);

      logger.error('[AuditLog] Flush failed, entries re-queued', {
        count: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Query audit logs from the database with filters.
   * Returns paginated results sorted by timestamp descending.
   */
  async query(filters: AuditQueryFilters): Promise<{ entries: AuditEntry[]; total: number }> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    // FIX A4-P1-001: Replaced $queryRawUnsafe with Prisma.sql tagged templates
    // to eliminate SQL injection risk. All values are safely parameterized.
    let whereClause = Prisma.sql`1=1`;

    if (filters.userId) {
      whereClause = Prisma.sql`${whereClause} AND "userId" = ${filters.userId}`;
    }
    if (filters.action) {
      whereClause = Prisma.sql`${whereClause} AND "action" = ${filters.action}`;
    }
    if (filters.resource) {
      whereClause = Prisma.sql`${whereClause} AND "resource" = ${filters.resource}`;
    }
    if (filters.startDate) {
      whereClause = Prisma.sql`${whereClause} AND "timestamp" >= ${filters.startDate}`;
    }
    if (filters.endDate) {
      whereClause = Prisma.sql`${whereClause} AND "timestamp" <= ${filters.endDate}`;
    }

    try {
      const [rows, countResult] = await Promise.all([
        prisma.$queryRaw<Array<{
          id: string;
          timestamp: Date;
          userId: string;
          userName: string | null;
          action: string;
          resource: string;
          resourceId: string | null;
          details: string | null;
          ipAddress: string | null;
          userAgent: string | null;
          result: string;
        }>>(
          Prisma.sql`SELECT * FROM "VoipAuditLog" WHERE ${whereClause}
           ORDER BY "timestamp" DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
        ),
        prisma.$queryRaw<Array<{ count: bigint }>>(
          Prisma.sql`SELECT COUNT(*) as count FROM "VoipAuditLog" WHERE ${whereClause}`
        ),
      ]);

      const entries: AuditEntry[] = rows.map(row => ({
        id: row.id,
        timestamp: new Date(row.timestamp),
        userId: row.userId,
        userName: row.userName || undefined,
        action: row.action as AuditAction,
        resource: row.resource,
        resourceId: row.resourceId || undefined,
        details: row.details ? JSON.parse(row.details) as Record<string, unknown> : undefined,
        ipAddress: row.ipAddress || undefined,
        userAgent: row.userAgent || undefined,
        result: row.result as 'success' | 'failure' | 'denied',
      }));

      const total = Number(countResult[0]?.count ?? 0);

      return { entries, total };
    } catch (error) {
      logger.error('[AuditLog] Query failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { entries: [], total: 0 };
    }
  }

  /**
   * Export audit log as CSV for compliance reporting.
   * Returns a CSV string with headers and all matching rows.
   */
  async exportCSV(filters: AuditQueryFilters): Promise<string> {
    // Fetch all matching entries (override limit for export)
    const exportFilters = { ...filters, limit: 10_000, offset: 0 };
    const { entries } = await this.query(exportFilters);

    const headers = [
      'ID', 'Timestamp', 'User ID', 'User Name', 'Action',
      'Resource', 'Resource ID', 'IP Address', 'User Agent', 'Result', 'Details',
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.timestamp.toISOString(),
      entry.userId,
      entry.userName || '',
      entry.action,
      entry.resource,
      entry.resourceId || '',
      entry.ipAddress || '',
      entry.userAgent || '',
      entry.result,
      entry.details ? JSON.stringify(entry.details) : '',
    ]);

    // Escape CSV fields (handle commas, quotes, newlines)
    const escapeField = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(escapeField).join(',')),
    ];

    logger.info('[AuditLog] CSV export generated', {
      rows: entries.length,
    });

    return csvLines.join('\n');
  }

  /**
   * Start auto-flush timer.
   * Periodically flushes the buffer to the database even if flushSize
   * has not been reached, preventing data loss on low-traffic periods.
   */
  startAutoFlush(intervalMs?: number): void {
    if (this.flushInterval) {
      return; // already running
    }

    const ms = intervalMs ?? this.flushIntervalMs;

    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        logger.error('[AuditLog] Auto-flush failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, ms);

    logger.info('[AuditLog] Auto-flush started', { intervalMs: ms });
  }

  /**
   * Stop auto-flush and flush any remaining entries.
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }

    // Final flush
    await this.flush();

    logger.info('[AuditLog] Stopped and flushed remaining entries');
  }

  /**
   * Check HIPAA compliance: verify that all required event types
   * have been logged at least once in the specified time window.
   * A missing event type may indicate a misconfigured integration.
   */
  async checkCompliance(): Promise<{
    compliant: boolean;
    missing: string[];
    warnings: string[];
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const rows = await prisma.$queryRaw<Array<{ action: string; count: bigint }>>`
        SELECT "action", COUNT(*) as count
        FROM "VoipAuditLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
        GROUP BY "action"
      `;

      const loggedActions = new Set(rows.map(r => r.action));

      const missing = REQUIRED_AUDIT_EVENTS.filter(
        action => !loggedActions.has(action)
      );

      const warnings: string[] = [];

      // Check for low-volume actions that may indicate issues
      for (const row of rows) {
        if (Number(row.count) < 5 && REQUIRED_AUDIT_EVENTS.includes(row.action as AuditAction)) {
          warnings.push(
            `Low volume for "${row.action}": only ${row.count} events in 30 days`
          );
        }
      }

      // Check for denied access patterns
      const deniedCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "VoipAuditLog"
        WHERE "result" = 'denied' AND "timestamp" >= ${thirtyDaysAgo}
      `;

      const denied = Number(deniedCount[0]?.count ?? 0);
      if (denied > 100) {
        warnings.push(
          `High number of denied access attempts: ${denied} in 30 days`
        );
      }

      const compliant = missing.length === 0;

      logger.info('[AuditLog] Compliance check', {
        compliant,
        missingCount: missing.length,
        warningCount: warnings.length,
      });

      return { compliant, missing, warnings };
    } catch (error) {
      logger.error('[AuditLog] Compliance check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        compliant: false,
        missing: REQUIRED_AUDIT_EVENTS,
        warnings: ['Compliance check could not query the database'],
      };
    }
  }
}
