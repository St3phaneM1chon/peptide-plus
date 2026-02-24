/**
 * PUT /api/admin/audits/findings/[id] - Update a finding (mark as fixed, false positive, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

export const PUT = withAdminGuard(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }>; session: { user?: { email?: string } } }
) => {
  const { id } = await context.params;
  const body = await request.json();

  const finding = await prisma.auditFinding.findUnique({ where: { id } });
  if (!finding) {
    return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.fixed !== undefined) {
    updateData.fixed = body.fixed;
    if (body.fixed) {
      updateData.fixedAt = new Date();
      updateData.fixedBy = context.session?.user?.email || 'unknown';
      if (body.fixCommit) updateData.fixCommit = body.fixCommit;
    } else {
      updateData.fixedAt = null;
      updateData.fixedBy = null;
      updateData.fixCommit = null;
    }
  }

  if (body.falsePositive !== undefined) {
    updateData.falsePositive = body.falsePositive;
  }

  const updated = await prisma.auditFinding.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ data: updated });
});
