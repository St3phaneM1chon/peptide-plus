export const dynamic = 'force-dynamic';

/**
 * CRM Adherence API - F3/F4
 * GET /api/admin/crm/adherence - Return adherence data
 *   Query params:
 *     - agentId (optional): Filter to a specific agent
 *     - date (optional): ISO date for historical data (default: today)
 *     - mode: "realtime" | "historical" (default: realtime)
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import {
  getRealtimeAdherence,
  getTeamAdherence,
  calculateAdherenceRate,
  getAdherenceExceptions,
} from '@/lib/crm/realtime-adherence';

// ---------------------------------------------------------------------------
// GET: Adherence data (realtime or historical)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const dateStr = searchParams.get('date');
    const mode = searchParams.get('mode') || 'realtime';

    // ---------------------------------------------------------------------------
    // Realtime mode
    // ---------------------------------------------------------------------------
    if (mode === 'realtime') {
      if (agentId) {
        const adherence = await getRealtimeAdherence(agentId);
        if (!adherence) {
          return apiError('Agent not found', ErrorCode.RESOURCE_NOT_FOUND, {
            status: 404,
            request,
          });
        }
        return apiSuccess(adherence, { request });
      }

      // Team adherence
      const teamAdherence = await getTeamAdherence();
      return apiSuccess(teamAdherence, { request });
    }

    // ---------------------------------------------------------------------------
    // Historical mode
    // ---------------------------------------------------------------------------
    if (mode === 'historical') {
      const date = dateStr ? new Date(dateStr) : new Date();
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (agentId) {
        const [rate, exceptions] = await Promise.all([
          calculateAdherenceRate(agentId, dayStart),
          getAdherenceExceptions(agentId, dayStart),
        ]);

        return apiSuccess({
          agentId,
          date: dayStart.toISOString(),
          adherenceRate: rate,
          exceptions,
        }, { request });
      }

      // Historical for all agents with schedules on that date
      const schedules = await prisma.agentSchedule.findMany({
        where: { date: dayStart },
        include: {
          agent: { select: { id: true, name: true, email: true, image: true } },
        },
      });

      // Batch fetch presence statuses for all agents at once instead of N+1
      const agentIds = schedules.map((s) => s.agentId);
      const presenceStatuses = agentIds.length > 0
        ? await prisma.presenceStatus.findMany({
            where: { userId: { in: agentIds } },
            select: { userId: true, status: true, onlineSince: true, lastActivity: true },
            orderBy: { updatedAt: 'desc' },
            distinct: ['userId'],
          })
        : [];
      const presenceMap = new Map(presenceStatuses.map((p) => [p.userId, p]));

      // Calculate adherence inline using prefetched schedule + presence data
      const results = schedules.map((s) => {
        let rate = 100;

        if (!s.isOff) {
          const [startH, startM] = s.startTime.split(':').map(Number);
          const [endH, endM] = s.endTime.split(':').map(Number);
          const shiftMinutes = (endH * 60 + endM) - (startH * 60 + startM);

          if (shiftMinutes > 0) {
            const presence = presenceMap.get(s.agentId);
            if (!presence || !presence.onlineSince) {
              rate = 0;
            } else {
              const shiftStart = new Date(dayStart);
              shiftStart.setHours(startH, startM, 0, 0);
              const shiftEnd = new Date(dayStart);
              shiftEnd.setHours(endH, endM, 0, 0);
              const effectiveStart = presence.onlineSince > shiftStart ? presence.onlineSince : shiftStart;
              const effectiveEnd = new Date() < shiftEnd ? new Date() : shiftEnd;
              const minutesPresent = Math.max(0, (effectiveEnd.getTime() - effectiveStart.getTime()) / 60000);
              rate = Math.min(100, Math.round((minutesPresent / shiftMinutes) * 100));
            }
          }
        }

        return {
          agentId: s.agentId,
          agentName: s.agent.name ?? s.agent.email ?? 'Unknown',
          agentImage: s.agent.image,
          scheduledShift: s.isOff ? 'DAY OFF' : `${s.shiftType} ${s.startTime}-${s.endTime}`,
          adherenceRate: rate,
          isOff: s.isOff,
        };
      });

      return apiSuccess({
        date: dayStart.toISOString(),
        agents: results,
        teamAverage: results.length > 0
          ? Math.round(results.reduce((s, r) => s + r.adherenceRate, 0) / results.length)
          : 0,
      }, { request });
    }

    return apiError('Invalid mode. Use "realtime" or "historical"', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      request,
    });
  } catch (error) {
    logger.error('[crm/adherence] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to retrieve adherence data', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.view' });
