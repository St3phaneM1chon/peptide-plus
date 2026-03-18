export const dynamic = 'force-dynamic';

/**
 * Mobile Aurelia Requests API
 * GET  /api/aurelia/requests — List Aurelia AI requests
 * POST /api/aurelia/requests — Create new request
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET — List Aurelia requests for the current user.
 */
export const GET = withMobileGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const requests = await prisma.aureliaRequest.findMany({
      where: { createdById: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const mapped = requests.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      priority: r.priority,
      status: r.status,
      requestType: r.requestType,
      createdById: r.createdById,
      createdByName: r.createdByName,
      assignedTo: r.assignedTo,
      response: r.response,
      scheduledFor: r.scheduledFor?.toISOString() || null,
      completedAt: r.completedAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      todoMasterId: r.todoMasterId,
      tags: r.tags,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    logger.error('[Aurelia Requests] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list requests' }, { status: 500 });
  }
});

/**
 * POST — Create a new Aurelia request.
 */
export const POST = withMobileGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = z.object({
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(5000),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'IMMEDIATE']).optional().default('NORMAL'),
      requestType: z.enum(['TASK', 'CODE', 'ANALYSIS', 'DEPLOY', 'AUDIT', 'RESEARCH', 'FIX', 'CREATE', 'OTHER']).optional().default('TASK'),
      tags: z.array(z.string().max(50)).max(10).optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { title, description, priority, requestType, tags } = parsed.data;

    const created = await prisma.aureliaRequest.create({
      data: {
        title,
        description,
        priority,
        requestType,
        status: 'PENDING',
        createdById: session.user.id,
        createdByName: session.user.name || session.user.email,
        tags: tags || [],
      },
    });

    logger.info('[Aurelia Requests] Created from mobile', {
      requestId: created.id,
      userId: session.user.id,
      type: requestType,
    });

    return NextResponse.json({
      id: created.id,
      title: created.title,
      description: created.description,
      priority: created.priority,
      status: created.status,
      requestType: created.requestType,
      createdById: created.createdById,
      createdByName: created.createdByName,
      assignedTo: created.assignedTo,
      response: created.response,
      scheduledFor: created.scheduledFor?.toISOString() || null,
      completedAt: created.completedAt?.toISOString() || null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      todoMasterId: created.todoMasterId,
      tags: created.tags,
    }, { status: 201 });
  } catch (error) {
    logger.error('[Aurelia Requests] POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
});
