export const dynamic = 'force-dynamic';

/**
 * Call Transfer & Conference API
 * POST — Execute transfer or conference actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import {
  blindTransfer,
  startAttendedTransfer,
  completeAttendedTransfer,
  cancelAttendedTransfer,
  createConference,
  addToConference,
  dialIntoConference,
  endConference,
} from '@/lib/voip/transfer-engine';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, callControlId, destination, conferenceId, conferenceName } = body;

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  switch (action) {
    case 'blind_transfer': {
      if (!callControlId || !destination) {
        return NextResponse.json(
          { error: 'callControlId and destination required' },
          { status: 400 }
        );
      }
      await blindTransfer(callControlId, destination);
      return NextResponse.json({ status: 'transferred' });
    }

    case 'attended_start': {
      if (!callControlId || !destination) {
        return NextResponse.json(
          { error: 'callControlId and destination required' },
          { status: 400 }
        );
      }
      await startAttendedTransfer(callControlId, destination, {
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/voip/webhooks/telnyx`,
      });
      return NextResponse.json({ status: 'consulting' });
    }

    case 'attended_complete': {
      if (!callControlId) {
        return NextResponse.json(
          { error: 'callControlId required' },
          { status: 400 }
        );
      }
      await completeAttendedTransfer(callControlId);
      return NextResponse.json({ status: 'bridged' });
    }

    case 'attended_cancel': {
      if (!callControlId) {
        return NextResponse.json(
          { error: 'callControlId required' },
          { status: 400 }
        );
      }
      await cancelAttendedTransfer(callControlId);
      return NextResponse.json({ status: 'cancelled' });
    }

    case 'conference_create': {
      if (!callControlId) {
        return NextResponse.json(
          { error: 'callControlId required' },
          { status: 400 }
        );
      }
      const name = conferenceName || `conf-${Date.now()}`;
      const confId = await createConference(callControlId, name);
      return NextResponse.json({ status: 'created', conferenceId: confId });
    }

    case 'conference_add': {
      if (!conferenceId || !callControlId) {
        return NextResponse.json(
          { error: 'conferenceId and callControlId required' },
          { status: 400 }
        );
      }
      await addToConference(conferenceId, callControlId);
      return NextResponse.json({ status: 'added' });
    }

    case 'conference_dial': {
      if (!conferenceId || !destination) {
        return NextResponse.json(
          { error: 'conferenceId and destination required' },
          { status: 400 }
        );
      }
      await dialIntoConference(conferenceId, destination);
      return NextResponse.json({ status: 'dialing' });
    }

    case 'conference_end': {
      if (!conferenceId) {
        return NextResponse.json(
          { error: 'conferenceId required' },
          { status: 400 }
        );
      }
      await endConference(conferenceId);
      return NextResponse.json({ status: 'ended' });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
