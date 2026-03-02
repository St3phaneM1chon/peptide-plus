export const dynamic = 'force-dynamic';

/**
 * Call Logs API
 * GET - Retrieve call logs with filtering and pagination
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import type { Prisma } from '@prisma/client';

export const GET = withAdminGuard(async (request) => {
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

  return NextResponse.json({
    callLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}, { skipCsrf: true });
