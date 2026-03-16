export const dynamic = 'force-dynamic';

/**
 * Call Transfer & Conference API
 * POST — Execute transfer or conference actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
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

const transferSchema = z.object({
  action: z.enum([
    'blind_transfer',
    'attended_start',
    'attended_complete',
    'attended_cancel',
    'conference_create',
    'conference_add',
    'conference_dial',
    'conference_end',
  ]),
  callControlId: z.string().optional(),
  destination: z.string().optional(),
  conferenceId: z.string().optional(),
  conferenceName: z.string().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const raw = await request.json();
    const parsed = transferSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { action, callControlId, destination, conferenceId, conferenceName } = parsed.data;

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
  } catch (error) {
    logger.error('[VoIP/Transfer] POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
