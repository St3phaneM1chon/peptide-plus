export const dynamic = 'force-dynamic';

/**
 * Power Dialer API
 * POST — Control dialer sessions (start, pause, resume, stop, disposition)
 * GET  — Get dialer session state and campaign stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import {
  startDialerSession,
  pauseSession,
  resumeSession,
  stopSession,
  submitDisposition,
  getSessionState,
  getAllSessions,
} from '@/lib/voip/power-dialer';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, campaignId, disposition } = body;
    const agentUserId = session.user.id;

    switch (action) {
      case 'start': {
        if (!campaignId) {
          return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
        }
        const result = await startDialerSession(campaignId, agentUserId);
        return NextResponse.json(result, {
          status: result.status === 'ok' ? 200 : 400,
        });
      }

      case 'pause':
        pauseSession(agentUserId);
        return NextResponse.json({ status: 'paused' });

      case 'resume':
        await resumeSession(agentUserId);
        return NextResponse.json({ status: 'resumed' });

      case 'stop':
        await stopSession(agentUserId);
        return NextResponse.json({ status: 'stopped' });

      case 'disposition': {
        if (!disposition) {
          return NextResponse.json({ error: 'disposition object required' }, { status: 400 });
        }
        if (!disposition.contactId || !disposition.result) {
          return NextResponse.json({ error: 'disposition.contactId and disposition.result required' }, { status: 400 });
        }
        const result = await submitDisposition(agentUserId, disposition);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const view = searchParams.get('view');

    if (view === 'all') {
      // Admin: see all active sessions
      return NextResponse.json({ data: getAllSessions() });
    }

    // Agent: see own session
    const state = getSessionState(session.user.id);
    return NextResponse.json({ data: state });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
