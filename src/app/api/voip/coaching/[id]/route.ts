export const dynamic = 'force-dynamic';

/**
 * Single Coaching Session API
 * GET    — Session detail with scores
 * PUT    — Update session (reschedule, feedback, etc.)
 * DELETE — Cancel session
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { getSessionScores } from '@/lib/voip/scoring-engine';
import { resolveTenant } from '@/lib/voip/tenant-context';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve tenant to scope by companyId
    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    const coachingSession = await prisma.coachingSession.findFirst({
      where: { id, companyId: tenant.companyId },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true } },
        callLog: {
          include: {
            recording: { select: { id: true, blobUrl: true, durationSec: true } },
            transcription: { select: { id: true, fullText: true } },
          },
        },
        scores: { orderBy: { criterion: 'asc' } },
      },
    });

    if (!coachingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Add computed overall score
    const { overallScore } = await getSessionScores(id);

    return NextResponse.json({
      data: {
        ...coachingSession,
        overallScore,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve tenant to scope by companyId
    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    // Verify session belongs to tenant
    const existing = await prisma.coachingSession.findFirst({
      where: { id, companyId: tenant.companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const raw = await request.json();
    const parsed = z.object({
      scheduledAt: z.string().optional(),
      topic: z.string().optional(),
      objectives: z.string().optional(),
      feedback: z.string().optional(),
      status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
      supervisorId: z.string().optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      scheduledAt,
      topic,
      objectives,
      feedback,
      status,
      supervisorId,
    } = parsed.data;

    const updated = await prisma.coachingSession.update({
      where: { id },
      data: {
        ...(scheduledAt !== undefined ? { scheduledAt: new Date(scheduledAt) } : {}),
        ...(topic !== undefined ? { topic } : {}),
        ...(objectives !== undefined ? { objectives } : {}),
        ...(feedback !== undefined ? { feedback } : {}),
        ...(status !== undefined ? { status: status as 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' } : {}),
        ...(supervisorId !== undefined ? { supervisorId } : {}),
      },
      include: {
        coach: { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve tenant to scope by companyId
    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    const coachingSession = await prisma.coachingSession.findFirst({
      where: { id, companyId: tenant.companyId },
      select: { status: true },
    });

    if (!coachingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (coachingSession.status === 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Cannot cancel an in-progress session. End the call first.' },
        { status: 400 }
      );
    }

    await prisma.coachingSession.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ status: 'cancelled' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
