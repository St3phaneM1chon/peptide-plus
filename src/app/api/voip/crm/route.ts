export const dynamic = 'force-dynamic';

/**
 * CRM Integration API
 * POST — Screen pop, click-to-call, call history, link call, add notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import {
  screenPop,
  clickToCall,
  getClientCallHistory,
  linkCallToClient,
  addCallNotes,
} from '@/lib/voip/crm-integration';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = z.object({
      action: z.enum(['screen-pop', 'click-to-call', 'call-history', 'link-call', 'add-notes']),
      phoneNumber: z.string().optional(),
      clientId: z.string().optional(),
      callerIdNumber: z.string().optional(),
      page: z.number().int().optional(),
      limit: z.number().int().optional(),
      callLogId: z.string().optional(),
      notes: z.string().optional(),
      disposition: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const { action } = body;

    switch (action) {
      case 'screen-pop': {
        if (!body.phoneNumber) {
          return NextResponse.json({ error: 'phoneNumber required' }, { status: 400 });
        }
        const result = await screenPop(body.phoneNumber);
        return NextResponse.json({ data: result });
      }

      case 'click-to-call': {
        if (!body.phoneNumber) {
          return NextResponse.json({ error: 'phoneNumber required' }, { status: 400 });
        }
        const result = await clickToCall({
          clientId: body.clientId,
          phoneNumber: body.phoneNumber,
          agentUserId: session.user.id,
          callerIdNumber: body.callerIdNumber,
        });
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ data: result });
      }

      case 'call-history': {
        if (!body.clientId) {
          return NextResponse.json({ error: 'clientId required' }, { status: 400 });
        }
        const result = await getClientCallHistory(body.clientId, {
          page: body.page,
          limit: body.limit,
        });
        return NextResponse.json({ data: result });
      }

      case 'link-call': {
        if (!body.callLogId || !body.clientId) {
          return NextResponse.json({ error: 'callLogId and clientId required' }, { status: 400 });
        }
        await linkCallToClient(body.callLogId, body.clientId);
        return NextResponse.json({ status: 'linked' });
      }

      case 'add-notes': {
        if (!body.callLogId || !body.notes) {
          return NextResponse.json({ error: 'callLogId and notes required' }, { status: 400 });
        }
        await addCallNotes(body.callLogId, body.notes, body.disposition, body.tags);
        return NextResponse.json({ status: 'saved' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    logger.error('[VoIP CRM] Request failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
