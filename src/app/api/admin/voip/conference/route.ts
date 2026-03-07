export const dynamic = 'force-dynamic';

/**
 * VoIP Conference API
 * GET  /api/admin/voip/conference — List active training rooms
 * POST /api/admin/voip/conference — Manage conferences
 *
 * Actions: create, add-participant, status, end
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  createTrainingRoom,
  addStudent,
  listActiveRooms,
  endTrainingRoom,
  getRoomStatus,
} from '@/lib/voip/training-conference';

const conferenceSchema = z.object({
  action: z.enum(['create', 'add-participant', 'status', 'end']),
  name: z.string().optional(),
  instructorPhone: z.string().optional(),
  conferenceId: z.string().optional(),
  participantPhone: z.string().optional(),
  participantName: z.string().optional(),
});

export const GET = withAdminGuard(async () => {
  try {
    const rooms = listActiveRooms();
    return NextResponse.json({ conferences: rooms });
  } catch {
    return NextResponse.json({ error: 'Failed to list conferences' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = conferenceSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const { action } = body;

    switch (action) {
      case 'create': {
        const { name, instructorPhone } = body;

        if (!name) {
          return NextResponse.json({ error: 'name required' }, { status: 400 });
        }

        const result = await createTrainingRoom({
          name,
          instructorPhone: instructorPhone || '',
          instructorUserId: session.user.id,
        });

        return NextResponse.json({ conference: result }, { status: 201 });
      }

      case 'add-participant': {
        const { conferenceId, participantPhone, participantName } = body;

        if (!conferenceId || !participantPhone) {
          return NextResponse.json(
            { error: 'conferenceId and participantPhone required' },
            { status: 400 }
          );
        }

        const result = await addStudent(
          conferenceId,
          participantPhone,
          session.user.id,
          participantName || 'Participant'
        );

        if (result.status.startsWith('error')) {
          return NextResponse.json({ error: result.status }, { status: 422 });
        }

        return NextResponse.json({ added: true, status: result.status });
      }

      case 'status': {
        const { conferenceId } = body;
        if (!conferenceId) {
          return NextResponse.json({ error: 'conferenceId required' }, { status: 400 });
        }

        const status = getRoomStatus(conferenceId);
        if (!status) {
          return NextResponse.json({ error: 'Conference not found' }, { status: 404 });
        }

        return NextResponse.json({ conference: status });
      }

      case 'end': {
        const { conferenceId: endId } = body;
        if (!endId) {
          return NextResponse.json({ error: 'conferenceId required' }, { status: 400 });
        }

        await endTrainingRoom(endId);
        return NextResponse.json({ ended: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Conference operation failed' }, { status: 500 });
  }
});
