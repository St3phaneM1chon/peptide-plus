export const dynamic = 'force-dynamic';

/**
 * Post-Call Survey Submit API
 * POST - Submit survey results (called by FreeSWITCH Lua script after IVR survey)
 *
 * This endpoint does NOT require admin auth — called by FreeSWITCH.
 * Security: Validates shared secret using timing-safe comparison.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
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

/**
 * Timing-safe secret comparison to prevent timing attacks.
 * Returns true only if both strings are equal, using constant-time comparison.
 */
function timingSafeSecretMatch(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Validate webhook auth using timing-safe comparison (I-SECURITY: prevent timing attacks)
  const secret = process.env.VOIP_CDR_WEBHOOK_SECRET;
  if (!secret) {
    // Reject in production if no secret configured — never allow open access
    if (process.env.NODE_ENV === 'production') {
      logger.error('[Survey] VOIP_CDR_WEBHOOK_SECRET not set in production — rejecting request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.warn('[Survey] No VOIP_CDR_WEBHOOK_SECRET configured (dev mode — allowing request)');
  } else {
    const authHeader = request.headers.get('authorization') || '';
    const customHeader = request.headers.get('x-cdr-secret') || '';
    // Extract Bearer token if present
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!timingSafeSecretMatch(bearerToken, secret) && !timingSafeSecretMatch(customHeader, secret)) {
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
