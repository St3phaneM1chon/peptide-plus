export const dynamic = 'force-dynamic';

/**
 * Admin Email Logs API
 * GET  - List email send logs with filters (JSON or CSV export), or ?summary=true for aggregate stats
 * POST - Retry sending a failed email by logId
 *
 * CSRF Mitigation (#30): Protected by withAdminGuard (session auth) +
 * JSON Content-Type (triggers CORS preflight for cross-origin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const retryEmailSchema = z.object({
  logId: z.string().min(1, 'logId is required'),
});

const archiveEmailLogsSchema = z.object({
  olderThanDays: z.number().int().min(1).max(365).default(90),
});

// Shared filter builder for both JSON and CSV responses
function buildLogFilters(searchParams: URLSearchParams): Record<string, unknown> {
  const status = searchParams.get('status');
  const to = searchParams.get('to');
  const templateId = searchParams.get('templateId');
  const from = searchParams.get('from');
  const until = searchParams.get('until');
  const archived = searchParams.get('archived') === 'true';

  const excludeCampaigns = searchParams.get('excludeCampaigns') === 'true';

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (to) where.to = { contains: to, mode: 'insensitive' };
  if (templateId) where.templateId = templateId;
  // Exclude campaign/group emails when browsing "Sent" folder
  // Campaign emails have abVariant set (A/B test) - individual emails don't
  if (excludeCampaigns) where.abVariant = null;

  // Date range filter (Faille #9: validate date strings to prevent DoS)
  if (from || until) {
    where.sentAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) (where.sentAt as Record<string, unknown>).gte = fromDate;
    }
    if (until) {
      const untilDate = new Date(until);
      if (!isNaN(untilDate.getTime())) (where.sentAt as Record<string, unknown>).lte = untilDate;
    }
    // Remove empty sentAt filter
    if (Object.keys(where.sentAt as object).length === 0) delete where.sentAt;
  } else if (!archived) {
    // Default: only show logs from the last 90 days (performance optimization)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    where.sentAt = { gte: ninetyDaysAgo };
  } else {
    // archived=true with no date range: show logs OLDER than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    where.sentAt = { lt: ninetyDaysAgo };
  }

  return where;
}

// Escape a CSV field value (handles commas, quotes, newlines)
function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/admin/emails/logs - List email logs with filters (JSON, CSV, or summary)
export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const summary = searchParams.get('summary') === 'true';

    // Summary mode: aggregate stats for admin dashboard
    if (summary) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Status counts (last 30 days)
      const statusCounts = await prisma.emailLog.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { sentAt: { gte: thirtyDaysAgo } },
      });

      const counts: Record<string, number> = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        failed: 0,
      };
      for (const row of statusCounts) {
        const key = (row.status || 'unknown').toLowerCase();
        counts[key] = (counts[key] || 0) + row._count.id;
      }
      counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

      // Daily breakdown for last 30 days
      const dailyStats = await prisma.$queryRaw<
        Array<{ day: string; status: string; count: bigint }>
      >`
        SELECT DATE(COALESCE("sentAt", "createdAt")) as day, status, COUNT(*) as count
        FROM "EmailLog"
        WHERE COALESCE("sentAt", "createdAt") >= ${thirtyDaysAgo}
        GROUP BY day, status
        ORDER BY day DESC
      `;

      const dailyBreakdown = dailyStats.map((row) => ({
        day: row.day,
        status: row.status,
        count: Number(row.count),
      }));

      // Top 5 most active templates
      const topTemplates = await prisma.emailLog.groupBy({
        by: ['templateId'],
        _count: { id: true },
        where: {
          sentAt: { gte: thirtyDaysAgo },
          templateId: { not: null },
        },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      });

      return NextResponse.json({
        summary: {
          counts,
          dailyBreakdown,
          topTemplates: topTemplates.map((t) => ({
            templateId: t.templateId,
            count: t._count.id,
          })),
          period: {
            from: thirtyDaysAgo.toISOString(),
            to: new Date().toISOString(),
          },
        },
      });
    }

    const where = buildLogFilters(searchParams);

    // CSV export mode
    if (format === 'csv') {
      const CSV_MAX_ROWS = 10000;
      const logs = await prisma.emailLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: CSV_MAX_ROWS,
        select: {
          id: true,
          to: true,
          subject: true,
          templateId: true,
          status: true,
          sentAt: true,
          error: true,
        },
      });

      const csvHeader = 'id,to,subject,templateId,status,sentAt,error';
      const csvRows = logs.map((log) =>
        [
          csvEscape(log.id),
          csvEscape(log.to),
          csvEscape(log.subject),
          csvEscape(log.templateId),
          csvEscape(log.status),
          csvEscape(log.sentAt?.toISOString()),
          csvEscape(log.error),
        ].join(',')
      );

      const csvContent = [csvHeader, ...csvRows].join('\n');
      const timestamp = new Date().toISOString().slice(0, 10);

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="email-logs-${timestamp}.csv"`,
        },
      });
    }

    // Default JSON mode
    const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1', 10) || 1, 10000));
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Admin email logs GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/emails/logs - Archive (delete) old email logs
export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = archiveEmailLogsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const olderThanDays = parsed.data.olderThanDays;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.emailLog.deleteMany({
      where: { sentAt: { lt: cutoffDate } },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'ARCHIVE_EMAIL_LOGS',
      targetType: 'EmailLog',
      targetId: 'bulk',
      newValue: { olderThanDays, cutoffDate: cutoffDate.toISOString(), deletedCount: result.count },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      olderThanDays,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    logger.error('Admin email logs DELETE (archive) error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/emails/logs - Retry sending a failed email
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = retryEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { logId } = parsed.data;

    // Find the original email log entry
    const logEntry = await prisma.emailLog.findUnique({ where: { id: logId } });
    if (!logEntry) {
      return NextResponse.json({ error: 'Email log entry not found' }, { status: 404 });
    }

    if (logEntry.status !== 'failed') {
      return NextResponse.json(
        { error: `Can only retry failed emails. Current status: ${logEntry.status}` },
        { status: 400 },
      );
    }

    // Re-send the email with the same parameters
    const result = await sendEmail({
      to: { email: logEntry.to },
      subject: logEntry.subject,
      html: '<p>Retry of failed email</p>', // Minimal fallback - original HTML is not stored in EmailLog
      tags: ['retry'],
    });

    if (result.success) {
      // Update the original log entry to reflect the retry
      await prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: 'retried',
          error: null,
          messageId: result.messageId || logEntry.messageId,
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'RETRY_FAILED_EMAIL',
        targetType: 'EmailLog',
        targetId: logId,
        previousValue: { status: 'failed', error: logEntry.error },
        newValue: { status: 'retried', messageId: result.messageId },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        logId,
        newMessageId: result.messageId,
        message: 'Email retry sent successfully',
      });
    } else {
      return NextResponse.json(
        { error: `Retry failed: ${result.error || 'Unknown error'}` },
        { status: 502 },
      );
    }
  } catch (error) {
    logger.error('Admin email logs POST (retry) error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
