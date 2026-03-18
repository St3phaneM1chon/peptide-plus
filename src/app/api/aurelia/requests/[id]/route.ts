export const dynamic = 'force-dynamic';

/**
 * Mobile Aurelia Request Detail API
 * PUT /api/aurelia/requests/[id] — Update request status
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * PUT — Update an Aurelia request (status, response, etc.)
 */
export const PUT = withMobileGuard(async (request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'Request ID required' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = z.object({
      status: z.enum(['PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
      response: z.string().optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status) updateData.status = parsed.data.status;
    if (parsed.data.response) updateData.response = parsed.data.response;
    if (parsed.data.status === 'COMPLETED') updateData.completedAt = new Date();

    const updated = await prisma.aureliaRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      priority: updated.priority,
      status: updated.status,
      requestType: updated.requestType,
      createdById: updated.createdById,
      createdByName: updated.createdByName,
      assignedTo: updated.assignedTo,
      response: updated.response,
      scheduledFor: updated.scheduledFor?.toISOString() || null,
      completedAt: updated.completedAt?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      todoMasterId: updated.todoMasterId,
      tags: updated.tags,
    });
  } catch (error) {
    logger.error('[Aurelia Request] PUT failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
});
