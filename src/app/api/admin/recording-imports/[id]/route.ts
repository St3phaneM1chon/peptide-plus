export const dynamic = 'force-dynamic';

/**
 * Recording Import Detail API
 * GET   - Get import details
 * PATCH - Update import (skip, retry)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

const patchSchema = z.object({
  action: z.enum(['skip', 'retry']),
});

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;

  try {
    const imp = await prisma.recordingImport.findUnique({
      where: { id },
      include: {
        connection: { select: { platform: true } },
        video: {
          select: {
            id: true,
            title: true,
            status: true,
            featuredClientId: true,
            consents: { select: { id: true, status: true, clientId: true } },
          },
        },
      },
    });

    if (!imp) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    return NextResponse.json(imp);
  } catch (error) {
    logger.error(`[RecordingImports] GET ${id} error:`, error);
    return NextResponse.json({ error: 'Failed to fetch import' }, { status: 500 });
  }
});

export const PATCH = withAdminGuard(async (request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { action } = parsed.data;

    const imp = await prisma.recordingImport.findUnique({ where: { id } });
    if (!imp) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    if (action === 'skip') {
      await prisma.recordingImport.update({
        where: { id },
        data: { status: 'skipped' },
      });
      return NextResponse.json({ success: true, status: 'skipped' });
    }

    if (action === 'retry') {
      if (imp.status !== 'failed') {
        return NextResponse.json({ error: 'Can only retry failed imports' }, { status: 400 });
      }
      await prisma.recordingImport.update({
        where: { id },
        data: { status: 'pending', error: null },
      });
      return NextResponse.json({ success: true, status: 'pending' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error(`[RecordingImports] PATCH ${id} error:`, error);
    return NextResponse.json({ error: 'Failed to update import' }, { status: 500 });
  }
});
