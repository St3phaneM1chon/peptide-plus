export const dynamic = 'force-dynamic';

/**
 * Video Workflow Transition API
 * C-19: Content approval workflow transitions.
 * POST /api/admin/videos/[id]/workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { transitionVideoStatus, getAvailableTransitions } from '@/lib/media/approval-workflow';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const transitionSchema = z.object({
  targetStatus: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']),
});

export const POST = withAdminGuard(async (request: NextRequest, { params, session }) => {
  const id = params?.id as string;
  const body = await request.json();
  const parsed = transitionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid target status' }, { status: 400 });
  }

  const result = await transitionVideoStatus(id, parsed.data.targetStatus, session.user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  logAdminAction({
    adminUserId: session.user.id,
    action: 'WORKFLOW_TRANSITION',
    targetType: 'Video',
    targetId: id,
    newValue: { targetStatus: parsed.data.targetStatus },
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json({ success: true, newStatus: result.newStatus });
});

export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  const id = params?.id as string;
  const video = await prisma.video.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  return NextResponse.json({
    currentStatus: video.status,
    availableTransitions: getAvailableTransitions(video.status),
  });
});
