export const dynamic = 'force-dynamic';

/**
 * Post-Call Survey Submit API
 * POST - Submit survey results (called by FreeSWITCH Lua script after IVR survey)
 *
 * This endpoint does NOT require admin auth — called by FreeSWITCH.
 * Security: Validates shared secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const surveySchema = z.object({
  callLogId: z.string().optional(),
  pbxUuid: z.string().optional(),
  overallScore: z.number().int().min(1).max(5).optional(),
  resolvedScore: z.number().int().min(1).max(5).optional(),
  method: z.enum(['dtmf', 'web_form']).default('dtmf'),
});

export async function POST(request: NextRequest) {
  // Validate webhook auth
  const secret = process.env.VOIP_CDR_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization') || '';
    const customHeader = request.headers.get('x-cdr-secret') || '';
    if (!authHeader.includes(secret) && customHeader !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const parsed = surveySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Find the call log
    let callLogId = parsed.data.callLogId;

    if (!callLogId && parsed.data.pbxUuid) {
      const callLog = await prisma.callLog.findUnique({
        where: { pbxUuid: parsed.data.pbxUuid },
        select: { id: true },
      });
      callLogId = callLog?.id;
    }

    if (!callLogId) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Check if survey already exists
    const existing = await prisma.callSurvey.findUnique({
      where: { callLogId },
    });
    if (existing) {
      return NextResponse.json({ error: 'Survey already submitted' }, { status: 409 });
    }

    const survey = await prisma.callSurvey.create({
      data: {
        callLogId,
        overallScore: parsed.data.overallScore,
        resolvedScore: parsed.data.resolvedScore,
        method: parsed.data.method,
        completedAt: new Date(),
      },
    });

    logger.info(`[Survey] Submitted for call ${callLogId}`, {
      overallScore: parsed.data.overallScore,
      resolvedScore: parsed.data.resolvedScore,
    });

    return NextResponse.json({ surveyId: survey.id }, { status: 201 });
  } catch (error) {
    logger.error('[Survey] Failed to submit', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
