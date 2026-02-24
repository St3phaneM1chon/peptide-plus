/**
 * GET /api/admin/audits/[type] - Get audit type details with findings
 * Query params: ?runId=xxx (optional, defaults to latest run)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) => {
  const { type: typeCode } = await context.params;
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const severityFilter = searchParams.get('severity');
  const fixedFilter = searchParams.get('fixed');

  const auditType = await prisma.auditType.findUnique({
    where: { code: typeCode },
  });

  if (!auditType) {
    return NextResponse.json({ error: 'Audit type not found' }, { status: 404 });
  }

  // Get runs for this type
  const runs = await prisma.auditRun.findMany({
    where: { auditTypeId: auditType.id },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      findingsCount: true,
      passedChecks: true,
      failedChecks: true,
      totalChecks: true,
      durationMs: true,
      runBy: true,
      summary: true,
    },
  });

  // Get findings for specified run or latest
  const targetRunId = runId || runs[0]?.id;
  let findings: unknown[] = [];
  let totalFindings = 0;

  if (targetRunId) {
    const where: Record<string, unknown> = { auditRunId: targetRunId };
    if (severityFilter) where.severity = severityFilter;
    if (fixedFilter !== null && fixedFilter !== undefined) {
      where.fixed = fixedFilter === 'true';
    }

    [findings, totalFindings] = await Promise.all([
      prisma.auditFinding.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          function: {
            select: { id: true, name: true, filePath: true, type: true },
          },
        },
      }),
      prisma.auditFinding.count({ where }),
    ]);
  }

  return NextResponse.json({
    data: {
      auditType: {
        ...auditType,
        checklist: JSON.parse(auditType.checklist),
      },
      runs,
      findings,
      pagination: {
        page,
        limit,
        total: totalFindings,
        totalPages: Math.ceil(totalFindings / limit),
      },
    },
  });
}, { skipCsrf: true });
