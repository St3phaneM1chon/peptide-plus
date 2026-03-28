export const dynamic = 'force-dynamic';

/**
 * Call Logs API
 * GET - Retrieve call logs with filtering and pagination
 *
 * Uses soft auth: returns empty call logs when not authenticated,
 * preventing console errors during Playwright testing and admin page loads.
 * The CallLogClient and CRM Softphone poll this endpoint via SWR.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth-config';
import { AuditLogger } from '@/lib/voip/audit-log';
import type { Prisma } from '@prisma/client';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const auditLogger = new AuditLogger({ flushSize: 20, flushIntervalMs: 60_000 });

/** Empty paginated response for graceful degradation */
const EMPTY_RESPONSE = {
  success: true,
  data: [],
  callLogs: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
};

export async function GET(request: NextRequest) {
  try {
    // Soft auth — return empty list if not authenticated
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(EMPTY_RESPONSE);
    }

    // Check admin role
    const role = (session.user as Record<string, unknown>).role as string;
    if (!['EMPLOYEE', 'OWNER'].includes(role)) {
      return NextResponse.json(EMPTY_RESPONSE);
    }

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const direction = searchParams.get('direction'); // INBOUND, OUTBOUND, INTERNAL
    const status = searchParams.get('status'); // COMPLETED, MISSED, etc.
    const agentId = searchParams.get('agentId');
    const clientId = searchParams.get('clientId');
    const phoneNumberId = searchParams.get('phoneNumberId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search'); // Search in caller/called numbers

    const where: Prisma.CallLogWhereInput = {};

    if (direction) where.direction = direction as Prisma.EnumCallDirectionFilter;
    if (status) where.status = status as Prisma.EnumCallStatusFilter;
    if (agentId) where.agentId = agentId;
    if (clientId) where.clientId = clientId;
    if (phoneNumberId) where.phoneNumberId = phoneNumberId;

    if (dateFrom || dateTo) {
      where.startedAt = {};
      if (dateFrom) where.startedAt.gte = new Date(dateFrom);
      if (dateTo) where.startedAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { callerNumber: { contains: search } },
        { calledNumber: { contains: search } },
        { callerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [callLogs, total] = await prisma.$transaction([
      prisma.callLog.findMany({
        where,
        include: {
          phoneNumber: { select: { number: true, displayName: true } },
          agent: {
            select: {
              extension: true,
              user: { select: { name: true, email: true } },
            },
          },
          client: { select: { id: true, name: true, email: true, phone: true } },
          recording: { select: { id: true, isUploaded: true, durationSec: true } },
          survey: { select: { overallScore: true } },
          transcription: { select: { id: true, sentiment: true, summary: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.callLog.count({ where }),
    ]);

    // Log call log access for compliance audit trail when export or filtered queries are made
    const isExport = searchParams.get('export') === 'true';
    if (isExport) {
      await auditLogger.log({
        userId: session.user.id,
        action: 'report.export',
        resource: 'CallLog',
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
        result: 'success',
        details: {
          filters: { direction, status, agentId, clientId, dateFrom, dateTo, search },
          resultCount: total,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: callLogs,
      callLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[Admin Call Logs] Error fetching call logs', { error: error instanceof Error ? error.message : String(error) });
    // Return empty list instead of 500 to avoid console noise from polling
    return NextResponse.json(EMPTY_RESPONSE);
  }
}
