export const dynamic = 'force-dynamic';

/**
 * CRM Agent Breaks API
 * GET  /api/admin/crm/agent-breaks - List breaks for today or date range, filter by agentId/type
 * POST /api/admin/crm/agent-breaks - Start a break (only one active break per agent)
 * PUT  /api/admin/crm/agent-breaks - End active break, compute duration
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const startBreakSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  type: z.enum(['LUNCH', 'SHORT_BREAK', 'TRAINING', 'MEETING', 'PERSONAL', 'OTHER']).default('SHORT_BREAK'),
  notes: z.string().max(500).optional().nullable(),
});

const endBreakSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
});

// ---------------------------------------------------------------------------
// GET: List breaks for today or date range
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const skip = (page - 1) * limit;

  // Filters
  const agentId = searchParams.get('agentId');
  const type = searchParams.get('type');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const activeOnly = searchParams.get('activeOnly');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (agentId) {
    where.agentId = agentId;
  }

  if (type) {
    where.type = type;
  }

  if (activeOnly === 'true') {
    where.endedAt = null;
  }

  if (dateFrom || dateTo) {
    where.startedAt = {};
    if (dateFrom) {
      where.startedAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      where.startedAt.lte = new Date(dateTo);
    }
  } else if (!agentId && !activeOnly) {
    // Default to today if no filters specified
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    where.startedAt = {
      gte: todayStart,
      lte: todayEnd,
    };
  }

  const [breaks, total] = await Promise.all([
    prisma.agentBreak.findMany({
      where,
      include: {
        agent: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.agentBreak.count({ where }),
  ]);

  return apiPaginated(breaks, page, limit, total, { request });
}, { requiredPermission: 'crm.leads.view' });

// ---------------------------------------------------------------------------
// POST: Start a break (only one active break per agent at a time)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = startBreakSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { agentId, type, notes } = parsed.data;

  // Verify agent exists
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });

  if (!agent) {
    return apiError('Agent not found', ErrorCode.RESOURCE_NOT_FOUND, {
      status: 404,
      request,
    });
  }

  // Check for active break (no endedAt)
  const activeBreak = await prisma.agentBreak.findFirst({
    where: {
      agentId,
      endedAt: null,
    },
    select: { id: true, type: true, startedAt: true },
  });

  if (activeBreak) {
    return apiError(
      `Agent already has an active ${activeBreak.type} break since ${activeBreak.startedAt.toISOString()}`,
      ErrorCode.CONFLICT,
      { status: 409, request }
    );
  }

  const agentBreak = await prisma.agentBreak.create({
    data: {
      agentId,
      type,
      notes: notes ?? null,
      startedAt: new Date(),
    },
    include: {
      agent: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  logger.info('Agent break started', {
    event: 'agent_break_started',
    breakId: agentBreak.id,
    agentId,
    type,
    userId: session.user.id,
  });

  return apiSuccess(agentBreak, { status: 201, request });
}, { requiredPermission: 'crm.leads.edit' });

// ---------------------------------------------------------------------------
// PUT: End active break, compute duration
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = endBreakSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { agentId } = parsed.data;

  // Find active break
  const activeBreak = await prisma.agentBreak.findFirst({
    where: {
      agentId,
      endedAt: null,
    },
    select: { id: true, startedAt: true },
  });

  if (!activeBreak) {
    return apiError('No active break found for this agent', ErrorCode.RESOURCE_NOT_FOUND, {
      status: 404,
      request,
    });
  }

  // Compute duration in seconds
  const now = new Date();
  const durationSeconds = Math.round((now.getTime() - activeBreak.startedAt.getTime()) / 1000);

  const updatedBreak = await prisma.agentBreak.update({
    where: { id: activeBreak.id },
    data: {
      endedAt: now,
      duration: durationSeconds,
    },
    include: {
      agent: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  logger.info('Agent break ended', {
    event: 'agent_break_ended',
    breakId: updatedBreak.id,
    agentId,
    durationSeconds,
    userId: session.user.id,
  });

  return apiSuccess(updatedBreak, { request });
}, { requiredPermission: 'crm.leads.edit' });
