export const dynamic = 'force-dynamic';

/**
 * Wrap-Up API — POST /api/voip/wrap-up
 *
 * Called by the Softphone after an agent selects a disposition.
 * Saves disposition + notes to the CallLog and triggers the
 * post-call workflow (CRM tasks, tickets, deals, DNCL, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { executePostCallWorkflow } from '@/lib/voip/post-call-workflow';

const wrapUpSchema = z.object({
  callLogId: z.string().min(1),
  disposition: z.string().min(1),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = wrapUpSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { callLogId, disposition, notes, tags } = parsed.data;

    // Fetch the call log to get context for the workflow
    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
      select: {
        id: true,
        clientId: true,
        agentId: true,
        callerNumber: true,
        calledNumber: true,
        duration: true,
        status: true,
        tags: true,
      },
    });

    if (!callLog) {
      return NextResponse.json({ error: 'Call log not found' }, { status: 404 });
    }

    // Update the CallLog with disposition, notes, and tags
    const mergedTags = tags
      ? [...new Set([...(callLog.tags || []), ...tags])]
      : callLog.tags;

    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        disposition,
        ...(notes ? { agentNotes: notes } : {}),
        tags: mergedTags,
      },
    });

    // Resolve agent userId from SipExtension
    let agentUserId: string | null = session.user.id;
    if (callLog.agentId) {
      const ext = await prisma.sipExtension.findUnique({
        where: { id: callLog.agentId },
        select: { userId: true },
      });
      if (ext?.userId) agentUserId = ext.userId;
    }

    // Execute post-call workflow (non-blocking)
    executePostCallWorkflow({
      callLogId,
      clientId: callLog.clientId,
      agentUserId,
      disposition,
      agentNotes: notes || null,
      callerNumber: callLog.callerNumber,
      calledNumber: callLog.calledNumber,
      duration: callLog.duration,
      status: callLog.status as string,
      tags: mergedTags,
    }).catch((err) => {
      logger.error('[WrapUp API] Post-call workflow error', {
        callLogId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    logger.info('[WrapUp API] Disposition saved + workflow triggered', {
      callLogId,
      disposition,
      userId: session.user.id,
    });

    return NextResponse.json({ status: 'saved', disposition });
  } catch (error) {
    logger.error('[WrapUp API] Request failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
