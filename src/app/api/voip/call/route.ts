export const dynamic = 'force-dynamic';

/**
 * VoIP Call Management API
 *
 * POST /api/voip/call — Initiate an outbound call
 * GET  /api/voip/call — List recent calls (with filters)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import * as telnyx from '@/lib/telnyx';

const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID || '';
const DEFAULT_CALLER_ID = process.env.TELNYX_DEFAULT_CALLER_ID || '+14388030370';
const WEBHOOK_BASE_URL = process.env.NEXTAUTH_URL || 'https://biocyclepeptides.com';

/**
 * POST - Initiate an outbound call via Telnyx Call Control.
 */
export const POST = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const raw = await request.json();
    const parsed = z.object({
      to: z.string().min(1),
      from: z.string().optional(),
      userId: z.string().optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { to, from, userId } = parsed.data;

    // Normalize number to E.164
    const toNumber = normalizeE164(to);
    if (!toNumber) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    const fromNumber = from || DEFAULT_CALLER_ID;
    const webhookUrl = `${WEBHOOK_BASE_URL}/api/voip/webhooks/telnyx`;

    // Initiate the call
    const result = await telnyx.dialCall({
      to: toNumber,
      from: fromNumber,
      connectionId: TELNYX_CONNECTION_ID,
      webhookUrl,
      clientState: JSON.stringify({ userId, source: 'manual' }),
      timeout: 30,
    });

    logger.info('[VoIP Call] Outbound call initiated', {
      to: toNumber,
      from: fromNumber,
      userId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[VoIP Call] Failed to initiate call', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to initiate call' },
      { status: 500 }
    );
  }
});

/**
 * GET - List recent calls with optional filters.
 */
export const GET = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const direction = searchParams.get('direction');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const companyId = searchParams.get('companyId');

    const where: Record<string, unknown> = {};
    if (direction) where.direction = direction.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (companyId) where.companyId = companyId;

    const [calls, total] = await Promise.all([
      prisma.callLog.findMany({
        where,
        include: {
          recording: { select: { id: true, durationSec: true, isTranscribed: true } },
          transcription: { select: { id: true, summary: true, sentiment: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.callLog.count({ where }),
    ]);

    return NextResponse.json({
      data: calls,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    logger.error('[VoIP Call] Failed to list calls', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list calls' }, { status: 500 });
  }
});

/**
 * Normalize a phone number to E.164 format.
 * Handles: 5145551234, 15145551234, +15145551234, (514) 555-1234
 */
function normalizeE164(input: string): string | null {
  // Strip non-digit chars except leading +
  const cleaned = input.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    // Already E.164
    return cleaned.length >= 11 ? cleaned : null;
  }

  const digits = cleaned.replace(/\D/g, '');

  if (digits.length === 10) {
    // North American 10-digit
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    // North American 11-digit (1 + 10)
    return `+${digits}`;
  }

  if (digits.length > 10) {
    // International - assume has country code
    return `+${digits}`;
  }

  return null;
}
