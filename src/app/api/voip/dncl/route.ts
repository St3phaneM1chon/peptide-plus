export const dynamic = 'force-dynamic';

/**
 * DNCL (Do Not Call List) Management API
 * GET  — Stats and search
 * POST — Check, import, add, remove
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import {
  checkDncl,
  bulkCheckDncl,
  importDnclList,
  addToDncl,
  removeFromDncl,
  getDnclStats,
} from '@/lib/voip/dncl';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getDnclStats();
    return NextResponse.json({ data: stats });
  } catch (error) {
    logger.error('[VoIP/DNCL] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = z.object({
      action: z.enum(['check', 'bulk-check', 'import', 'add', 'remove']),
      phoneNumber: z.string().optional(),
      phoneNumbers: z.array(z.string()).optional(),
      source: z.string().optional(),
      reason: z.string().optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const { action } = body;

    switch (action) {
      case 'check': {
        if (!body.phoneNumber) {
          return NextResponse.json({ error: 'phoneNumber required' }, { status: 400 });
        }
        const blocked = await checkDncl(body.phoneNumber);
        return NextResponse.json({ data: { phoneNumber: body.phoneNumber, blocked } });
      }

      case 'bulk-check': {
        if (!body.phoneNumbers?.length) {
          return NextResponse.json({ error: 'phoneNumbers array required' }, { status: 400 });
        }
        const blockedSet = await bulkCheckDncl(body.phoneNumbers);
        return NextResponse.json({
          data: {
            checked: body.phoneNumbers.length,
            blocked: [...blockedSet],
          },
        });
      }

      case 'import': {
        if (!body.phoneNumbers?.length) {
          return NextResponse.json({ error: 'phoneNumbers array required' }, { status: 400 });
        }
        const result = await importDnclList(body.phoneNumbers, body.source || 'crtc');
        return NextResponse.json({ data: result });
      }

      case 'add': {
        if (!body.phoneNumber) {
          return NextResponse.json({ error: 'phoneNumber required' }, { status: 400 });
        }
        await addToDncl(body.phoneNumber, body.reason);
        return NextResponse.json({ status: 'added' });
      }

      case 'remove': {
        if (!body.phoneNumber) {
          return NextResponse.json({ error: 'phoneNumber required' }, { status: 400 });
        }
        const removed = await removeFromDncl(body.phoneNumber);
        if (!removed) {
          return NextResponse.json(
            { error: 'Number not found or cannot be removed (CRTC entries are permanent)' },
            { status: 400 }
          );
        }
        return NextResponse.json({ status: 'removed' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    logger.error('[VoIP/DNCL] POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
