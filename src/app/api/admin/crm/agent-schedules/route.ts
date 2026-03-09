export const dynamic = 'force-dynamic';

/**
 * CRM Agent Schedules API
 * GET  /api/admin/crm/agent-schedules - List schedules with filters (agentId, date range, shiftType)
 * POST /api/admin/crm/agent-schedules - Create/upsert schedule (agentId+date unique)
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

const createScheduleSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  date: z.string().min(1, 'Date is required'), // ISO date string "YYYY-MM-DD"
  shiftType: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'SPLIT', 'CUSTOM']).default('MORNING'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM format').default('09:00'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM format').default('17:00'),
  isOff: z.boolean().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET: List schedules with filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const agentId = searchParams.get('agentId');
    const shiftType = searchParams.get('shiftType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (agentId) {
      where.agentId = agentId;
    }

    if (shiftType) {
      where.shiftType = shiftType;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo);
      }
    }

    const [schedules, total] = await Promise.all([
      prisma.agentSchedule.findMany({
        where,
        include: {
          agent: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.agentSchedule.count({ where }),
    ]);

    return apiPaginated(schedules, page, limit, total, { request });
  } catch (error) {
    logger.error('[AgentSchedules] Error listing schedules', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to list agent schedules', ErrorCode.INTERNAL_ERROR, { status: 500, request });
  }
}, { requiredPermission: 'crm.leads.view' });

// ---------------------------------------------------------------------------
// POST: Create or upsert schedule (agentId + date unique)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const { agentId, date, shiftType, startTime, endTime, isOff, notes } = parsed.data;

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

    // Parse date to Date object (date only, no time component)
    const scheduleDate = new Date(date + 'T00:00:00.000Z');

    // Upsert on agentId + date
    const schedule = await prisma.agentSchedule.upsert({
      where: {
        agentId_date: {
          agentId,
          date: scheduleDate,
        },
      },
      update: {
        shiftType,
        startTime,
        endTime,
        isOff,
        notes: notes ?? null,
      },
      create: {
        agentId,
        date: scheduleDate,
        shiftType,
        startTime,
        endTime,
        isOff,
        notes: notes ?? null,
      },
      include: {
        agent: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    logger.info('Agent schedule upserted', {
      event: 'agent_schedule_upserted',
      scheduleId: schedule.id,
      agentId,
      date,
      shiftType,
      isOff,
      userId: session.user.id,
    });

    return apiSuccess(schedule, { status: 201, request });
  } catch (error) {
    logger.error('[AgentSchedules] Error creating/updating schedule', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create/update schedule', ErrorCode.INTERNAL_ERROR, { status: 500, request });
  }
}, { requiredPermission: 'crm.leads.edit' });
