/**
 * xAPI Service — Learning Record Store (LRS) for advanced activity tracking
 *
 * Records xAPI statements following the ADL xAPI specification.
 * Stored locally in PostgreSQL (acts as internal LRS).
 * Can be exported to external LRS via API.
 */

import { prisma } from '@/lib/db';

// xAPI Verb IRIs (simplified to short names for storage)
export const XAPI_VERBS = {
  experienced: 'http://adlnet.gov/expapi/verbs/experienced',
  completed: 'http://adlnet.gov/expapi/verbs/completed',
  passed: 'http://adlnet.gov/expapi/verbs/passed',
  failed: 'http://adlnet.gov/expapi/verbs/failed',
  answered: 'http://adlnet.gov/expapi/verbs/answered',
  attempted: 'http://adlnet.gov/expapi/verbs/attempted',
  interacted: 'http://adlnet.gov/expapi/verbs/interacted',
  launched: 'http://adlnet.gov/expapi/verbs/launched',
  progressed: 'http://adlnet.gov/expapi/verbs/progressed',
} as const;

/**
 * Record an xAPI statement (non-blocking, fire-and-forget).
 */
export async function recordStatement(params: {
  tenantId: string;
  actorId: string;
  verb: string;
  objectType: string;
  objectId: string;
  objectName?: string;
  result?: {
    score?: { scaled?: number; raw?: number; min?: number; max?: number };
    success?: boolean;
    completion?: boolean;
    duration?: string; // ISO 8601 duration
    response?: string;
  };
  context?: {
    courseId?: string;
    chapterId?: string;
    platform?: string;
    language?: string;
    extensions?: Record<string, unknown>;
  };
}): Promise<void> {
  try {
    await prisma.xapiStatement.create({
      data: {
        tenantId: params.tenantId,
        actorId: params.actorId,
        verb: params.verb,
        objectType: params.objectType,
        objectId: params.objectId,
        objectName: params.objectName ?? null,
        result: params.result ? JSON.parse(JSON.stringify(params.result)) : undefined,
        context: params.context ? JSON.parse(JSON.stringify(params.context)) : undefined,
      },
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Query xAPI statements (for analytics/export).
 */
export async function queryStatements(tenantId: string, options?: {
  actorId?: string;
  verb?: string;
  objectType?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}) {
  const { actorId, verb, objectType, since, until, limit = 50, offset = 0 } = options ?? {};

  return prisma.xapiStatement.findMany({
    where: {
      tenantId,
      ...(actorId ? { actorId } : {}),
      ...(verb ? { verb } : {}),
      ...(objectType ? { objectType } : {}),
      ...(since || until ? {
        timestamp: {
          ...(since ? { gte: since } : {}),
          ...(until ? { lte: until } : {}),
        },
      } : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Export xAPI statements in standard JSON format (for external LRS).
 */
export async function exportStatements(tenantId: string, since?: Date) {
  const statements = await prisma.xapiStatement.findMany({
    where: { tenantId, ...(since ? { timestamp: { gte: since } } : {}) },
    orderBy: { timestamp: 'asc' },
    take: 1000,
  });

  return statements.map(s => ({
    id: s.id,
    actor: { objectType: 'Agent', account: { name: s.actorId } },
    verb: { id: XAPI_VERBS[s.verb as keyof typeof XAPI_VERBS] ?? s.verb, display: { 'en-US': s.verb } },
    object: { objectType: 'Activity', id: `${s.objectType}:${s.objectId}`, definition: { name: { 'en-US': s.objectName ?? s.objectId } } },
    result: s.result,
    context: s.context,
    timestamp: s.timestamp.toISOString(),
    stored: s.stored.toISOString(),
  }));
}
