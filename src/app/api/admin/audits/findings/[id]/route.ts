/**
 * PUT /api/admin/audits/findings/[id] - Update a finding (mark as fixed, false positive, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateFindingSchema = z.object({
  fixed: z.boolean().optional(),
  falsePositive: z.boolean().optional(),
  fixCommit: z.string().max(200).optional(),
}).refine(
  (data) => data.fixed !== undefined || data.falsePositive !== undefined,
  { message: 'At least one of "fixed" or "falsePositive" must be provided' }
);

export const PUT = withAdminGuard(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }>; session: { user: { id: string; email?: string | null } } }
) => {
  try {
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateFindingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const finding = await prisma.auditFinding.findUnique({ where: { id } });
    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.fixed !== undefined) {
      updateData.fixed = parsed.data.fixed;
      if (parsed.data.fixed) {
        updateData.fixedAt = new Date();
        updateData.fixedBy = context.session?.user?.email || 'unknown';
        if (parsed.data.fixCommit) updateData.fixCommit = parsed.data.fixCommit;
      } else {
        updateData.fixedAt = null;
        updateData.fixedBy = null;
        updateData.fixCommit = null;
      }
    }

    if (parsed.data.falsePositive !== undefined) {
      updateData.falsePositive = parsed.data.falsePositive;
    }

    const updated = await prisma.auditFinding.update({
      where: { id },
      data: updateData,
    });

    logAdminAction({
      adminUserId: context.session.user.id,
      action: 'UPDATE_AUDIT_FINDING',
      targetType: 'AuditFinding',
      targetId: id,
      previousValue: { fixed: finding.fixed, falsePositive: finding.falsePositive },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ data: updated });
  } catch (error) {
    logger.error('Update finding error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
