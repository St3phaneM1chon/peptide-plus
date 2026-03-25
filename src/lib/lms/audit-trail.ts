/**
 * LMS Audit Trail — Log all significant LMS actions for compliance.
 * Non-blocking (fire-and-forget) to avoid impacting response times.
 */

import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

export async function logAudit(params: {
  tenantId: string;
  userId?: string;
  action: string; // create, update, delete, enroll, complete, grade, export, login, view
  entity: string; // course, enrollment, quiz_attempt, certificate, corporate_account, etc.
  entityId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    try {
      const h = await headers();
      ipAddress = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
      userAgent = h.get('user-agent') ?? null;
    } catch {
      // headers() may not be available in all contexts
    }

    await prisma.lmsAuditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details: params.details ? JSON.parse(JSON.stringify(params.details)) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (e) {
    // Non-blocking but log for monitoring
    console.error('[audit-trail] Failed to log action', params.action, params.entity, e instanceof Error ? e.message : e);
  }
}

/**
 * Query audit logs for compliance reports.
 */
export async function getAuditLogs(tenantId: string, options?: {
  entity?: string;
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}) {
  const { entity, userId, action, from, to, limit = 50, offset = 0 } = options ?? {};

  const [logs, total] = await Promise.all([
    prisma.lmsAuditLog.findMany({
      where: {
        tenantId,
        ...(entity ? { entity } : {}),
        ...(userId ? { userId } : {}),
        ...(action ? { action } : {}),
        ...(from || to ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.lmsAuditLog.count({
      where: {
        tenantId,
        ...(entity ? { entity } : {}),
        ...(userId ? { userId } : {}),
        ...(action ? { action } : {}),
        ...(from || to ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        } : {}),
      },
    }),
  ]);

  return { logs, total, limit, offset };
}
