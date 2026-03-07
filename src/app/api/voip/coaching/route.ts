export const dynamic = 'force-dynamic';

/**
 * Coaching API
 * GET  — List coaching sessions (with filters)
 * POST — Create session, start call, supervisor actions, scoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import {
  startCoachingCall,
  supervisorJoin,
  changeSupervisorMode,
  endCoachingCall,
  type SupervisorMode,
} from '@/lib/voip/coaching-engine';
import { scoreCoachingSession, getStudentProgress } from '@/lib/voip/scoring-engine';
import { LiveCallScorer } from '@/lib/voip/live-scoring';
import {
  createTrainingRoom,
  addStudent,
  unmuteStudent,
  muteStudent,
  muteAllStudents,
  endTrainingRoom,
  listActiveRooms,
  getRoomStatus,
  raiseHand,
} from '@/lib/voip/training-conference';
import { AuditLogger } from '@/lib/voip/audit-log';

const auditLogger = new AuditLogger({ flushSize: 10, flushIntervalMs: 60_000 });

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyId = searchParams.get('companyId');
    const coachId = searchParams.get('coachId');
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');
    const view = searchParams.get('view');

    // List active training rooms
    if (view === 'training-rooms') {
      return NextResponse.json({ data: listActiveRooms() });
    }

    // Student progress report
    if (view === 'student-progress' && studentId) {
      const progress = await getStudentProgress(studentId);
      return NextResponse.json({ data: progress });
    }

    const sessions = await prisma.coachingSession.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(coachId ? { coachId } : {}),
        ...(studentId ? { studentId } : {}),
        ...(status ? { status: status as 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' } : {}),
      },
      include: {
        coach: { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
        scores: true,
        _count: { select: { scores: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ data: sessions });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = z.object({
      action: z.enum([
        'create', 'start-call', 'end-call', 'supervisor-join', 'supervisor-mode',
        'score', 'feedback', 'live-score', 'create-room', 'add-student',
        'unmute-student', 'mute-student', 'mute-all', 'raise-hand', 'room-status', 'end-room',
      ]),
      companyId: z.string().optional(),
      coachId: z.string().optional(),
      studentId: z.string().optional(),
      scheduledAt: z.string().optional(),
      topic: z.string().optional(),
      objectives: z.string().optional(),
      sessionId: z.string().optional(),
      callerIdNumber: z.string().optional(),
      supervisorPhone: z.string().optional(),
      mode: z.string().optional(),
      feedback: z.string().optional(),
      name: z.string().optional(),
      instructorPhone: z.string().optional(),
      conferenceId: z.string().optional(),
      studentPhone: z.string().optional(),
      studentUserId: z.string().optional(),
      studentName: z.string().optional(),
      callControlId: z.string().optional(),
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
      // ── Session CRUD ──────────────────
      case 'create': {
        const { companyId, coachId, studentId, scheduledAt, topic, objectives } = body;
        if (!companyId || !coachId || !studentId || !scheduledAt) {
          return NextResponse.json(
            { error: 'companyId, coachId, studentId, scheduledAt required' },
            { status: 400 }
          );
        }
        if (isNaN(new Date(scheduledAt).getTime())) {
          return NextResponse.json({ error: 'scheduledAt must be a valid ISO date' }, { status: 400 });
        }
        const created = await prisma.coachingSession.create({
          data: {
            companyId,
            coachId,
            studentId,
            scheduledAt: new Date(scheduledAt),
            topic,
            objectives,
          },
        });
        return NextResponse.json({ data: created }, { status: 201 });
      }

      // ── Call Control ──────────────────
      case 'start-call': {
        if (!body.sessionId) {
          return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }
        const result = await startCoachingCall(body.sessionId, {
          callerIdNumber: body.callerIdNumber,
        });

        // Audit log: coaching session started
        await auditLogger.log({
          userId: session.user.id,
          action: 'call.listen',
          resource: 'CoachingSession',
          resourceId: body.sessionId,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          result: result.status === 'ok' ? 'success' : 'failure',
          details: { action: 'start-call' },
        });

        return NextResponse.json(result, {
          status: result.status === 'ok' ? 200 : 400,
        });
      }

      case 'end-call': {
        if (!body.sessionId) {
          return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }
        await endCoachingCall(body.sessionId);
        return NextResponse.json({ status: 'ended' });
      }

      // ── Supervisor ──────────────────
      case 'supervisor-join': {
        const { sessionId, supervisorPhone, mode } = body;
        if (!sessionId || !supervisorPhone || !mode) {
          return NextResponse.json(
            { error: 'sessionId, supervisorPhone, mode required' },
            { status: 400 }
          );
        }
        // Validate phone format (E.164)
        if (!/^\+[1-9]\d{6,14}$/.test(supervisorPhone)) {
          return NextResponse.json({ error: 'supervisorPhone must be E.164 format (+1234567890)' }, { status: 400 });
        }
        const validModes: SupervisorMode[] = ['LISTEN', 'WHISPER', 'BARGE'];
        if (!validModes.includes(mode as SupervisorMode)) {
          return NextResponse.json({ error: 'mode must be LISTEN, WHISPER, or BARGE' }, { status: 400 });
        }

        // Update session with supervisor
        await prisma.coachingSession.update({
          where: { id: sessionId },
          data: { supervisorId: session.user.id },
        });

        const result = await supervisorJoin(sessionId, supervisorPhone, mode as SupervisorMode);

        // Audit log: supervisor joined coaching session (whisper/barge is sensitive)
        const auditAction = mode === 'WHISPER' ? 'call.whisper' as const : mode === 'BARGE' ? 'call.barge' as const : 'call.listen' as const;
        await auditLogger.log({
          userId: session.user.id,
          action: auditAction,
          resource: 'CoachingSession',
          resourceId: sessionId,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          result: result.status === 'ok' ? 'success' : 'failure',
          details: { mode, supervisorPhone },
        });

        return NextResponse.json(result, {
          status: result.status === 'ok' ? 200 : 400,
        });
      }

      case 'supervisor-mode': {
        if (!body.sessionId || !body.mode) {
          return NextResponse.json({ error: 'sessionId and mode required' }, { status: 400 });
        }
        await changeSupervisorMode(body.sessionId, body.mode as SupervisorMode);
        return NextResponse.json({ status: 'mode_changed', mode: body.mode });
      }

      // ── Scoring ──────────────────
      case 'score': {
        if (!body.sessionId) {
          return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }
        const scores = await scoreCoachingSession(body.sessionId);
        return NextResponse.json({ data: scores });
      }

      case 'feedback': {
        if (!body.sessionId || !body.feedback) {
          return NextResponse.json({ error: 'sessionId and feedback required' }, { status: 400 });
        }
        await prisma.coachingSession.update({
          where: { id: body.sessionId },
          data: { feedback: body.feedback },
        });
        return NextResponse.json({ status: 'saved' });
      }

      // ── AI Live Call Scoring ──────────────────
      case 'live-score': {
        if (!body.sessionId) {
          return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        // Fetch the session's call transcription
        const scoringSession = await prisma.coachingSession.findUnique({
          where: { id: body.sessionId },
          include: {
            callLog: {
              include: {
                transcription: { select: { fullText: true } },
              },
            },
          },
        });

        if (!scoringSession) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const transcriptText = scoringSession.callLog?.transcription?.fullText;
        if (!transcriptText) {
          return NextResponse.json({ error: 'No transcription available for scoring' }, { status: 400 });
        }

        // Feed the transcript to the LiveCallScorer and get a final scorecard
        const scorer = new LiveCallScorer({ updateInterval: 0 });
        // Split transcript into speaker-tagged lines and feed them
        const lines = transcriptText.split('\n').filter(Boolean);
        for (const line of lines) {
          const isAgent = line.toLowerCase().startsWith('[agent]');
          const speaker = isAgent ? 'agent' as const : 'customer' as const;
          const text = line.replace(/^\[(agent|customer)\]:\s*/i, '');
          await scorer.feedTranscript(text, speaker);
        }

        const scorecard = await scorer.getFinalScorecard();

        return NextResponse.json({
          data: {
            sessionId: body.sessionId,
            scorecard,
          },
        });
      }

      // ── Training Rooms ──────────────────
      case 'create-room': {
        const { name, instructorPhone } = body;
        if (!name || !instructorPhone) {
          return NextResponse.json({ error: 'name and instructorPhone required' }, { status: 400 });
        }
        const result = await createTrainingRoom({
          name,
          instructorPhone,
          instructorUserId: session.user.id,
          sessionId: body.sessionId,
          callerIdNumber: body.callerIdNumber,
        });
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ data: result }, { status: 201 });
      }

      case 'add-student': {
        const { conferenceId, studentPhone, studentUserId, studentName } = body;
        if (!conferenceId || !studentPhone || !studentUserId) {
          return NextResponse.json(
            { error: 'conferenceId, studentPhone, studentUserId required' },
            { status: 400 }
          );
        }
        const result = await addStudent(conferenceId, studentPhone, studentUserId, studentName || 'Student');
        return NextResponse.json({ data: result });
      }

      case 'unmute-student': {
        if (!body.conferenceId || !body.callControlId) {
          return NextResponse.json({ error: 'conferenceId and callControlId required' }, { status: 400 });
        }
        await unmuteStudent(body.conferenceId, body.callControlId);
        return NextResponse.json({ status: 'unmuted' });
      }

      case 'mute-student': {
        if (!body.conferenceId || !body.callControlId) {
          return NextResponse.json({ error: 'conferenceId and callControlId required' }, { status: 400 });
        }
        await muteStudent(body.conferenceId, body.callControlId);
        return NextResponse.json({ status: 'muted' });
      }

      case 'mute-all': {
        if (!body.conferenceId) {
          return NextResponse.json({ error: 'conferenceId required' }, { status: 400 });
        }
        await muteAllStudents(body.conferenceId);
        return NextResponse.json({ status: 'all_muted' });
      }

      case 'raise-hand': {
        if (!body.conferenceId || !body.callControlId) {
          return NextResponse.json({ error: 'conferenceId and callControlId required' }, { status: 400 });
        }
        const hands = raiseHand(body.conferenceId, body.callControlId);
        return NextResponse.json({ data: hands });
      }

      case 'room-status': {
        if (!body.conferenceId) {
          return NextResponse.json({ error: 'conferenceId required' }, { status: 400 });
        }
        const status = getRoomStatus(body.conferenceId);
        return NextResponse.json({ data: status });
      }

      case 'end-room': {
        if (!body.conferenceId) {
          return NextResponse.json({ error: 'conferenceId required' }, { status: 400 });
        }
        await endTrainingRoom(body.conferenceId);
        return NextResponse.json({ status: 'ended' });
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
