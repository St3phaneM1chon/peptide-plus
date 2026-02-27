export const dynamic = 'force-dynamic';

/**
 * Admin Audit Logs API
 * GET - List audit logs with user info, pagination, and filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GET /api/admin/logs - List audit logs with filtering
export const GET = withAdminGuard(async (request: NextRequest, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    const userId = searchParams.get('userId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');
    const level = searchParams.get('level');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (userId) {
      where.userId = userId;
    }

    // Level filter: map to action patterns
    // INFO = normal actions, WARNING = alerts/retries, ERROR = failures, DEBUG = system events
    if (level) {
      const levelActionPatterns: Record<string, string[]> = {
        ERROR: ['FAILED', 'ERROR'],
        WARNING: ['ALERT', 'RETRY', 'LOW_STOCK', 'WARNING'],
        DEBUG: ['CRON', 'SYSTEM', 'DEBUG'],
      };

      if (level !== 'INFO' && levelActionPatterns[level]) {
        where.OR = levelActionPatterns[level].map(pattern => ({
          action: { contains: pattern, mode: 'insensitive' },
        }));
      }
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        (where.createdAt as Record<string, unknown>).gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = toDate;
      }
    }

    if (search) {
      const searchConditions = [
        { action: { contains: search, mode: 'insensitive' as const } },
        { entityType: { contains: search, mode: 'insensitive' as const } },
        { details: { contains: search, mode: 'insensitive' as const } },
        { ipAddress: { contains: search, mode: 'insensitive' as const } },
      ];

      if (where.OR) {
        // Combine existing OR with search OR using AND
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [rawLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Fetch user info for logs that have userId
    const userIds = [...new Set(rawLogs.map(log => log.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, image: true, role: true },
        })
      : [];

    const userMap = new Map(users.map(u => [u.id, u]));

    // G5-FLAW-10: Improved log level classification with broader pattern matching
    const getLogLevel = (action: string): string => {
      const upper = action.toUpperCase();
      const errorPatterns = ['FAILED', 'ERROR', 'CRASH', 'EXCEPTION', 'UNAUTHORIZED', 'FORBIDDEN', 'TIMEOUT'];
      if (errorPatterns.some(p => upper.includes(p))) return 'ERROR';
      const warnPatterns = ['ALERT', 'RETRY', 'LOW_STOCK', 'WARNING', 'DEPRECATED', 'THROTTLE', 'RATE_LIMIT', 'SUSPICIOUS', 'EXPIRED'];
      if (warnPatterns.some(p => upper.includes(p))) return 'WARNING';
      const debugPatterns = ['CRON', 'SYSTEM', 'DEBUG', 'INTERNAL', 'CLEANUP', 'MIGRATION', 'SEED'];
      if (debugPatterns.some(p => upper.includes(p))) return 'DEBUG';
      return 'INFO';
    };

    // Parse details JSON and enrich with user info
    const logs = rawLogs.map(log => {
      const user = log.userId ? userMap.get(log.userId) : null;
      let parsedDetails: Record<string, unknown> | null = null;

      if (log.details) {
        try {
          parsedDetails = JSON.parse(log.details);
        } catch (error) {
          console.error('[AdminLogs] Failed to parse log details JSON:', error);
          parsedDetails = { raw: log.details };
        }
      }

      return {
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        level: getLogLevel(log.action),
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        userId: log.userId,
        userName: user?.name || user?.email || null,
        userImage: user?.image || null,
        userRole: user?.role || null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: parsedDetails,
      };
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Admin logs GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
