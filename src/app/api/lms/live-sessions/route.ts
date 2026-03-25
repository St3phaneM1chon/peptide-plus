export const dynamic = 'force-dynamic';

/**
 * Student-facing Live Sessions API
 * GET /api/lms/live-sessions — List upcoming published sessions
 */
import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';

export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const sessions = await prisma.liveSession.findMany({
    where: {
      tenantId,
      isPublished: true,
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: 'asc' },
    take: 20,
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      platform: true,
      meetingUrl: true,
      _count: { select: { attendees: true } },
    },
  });

  // P8-26 FIX: Only reveal meetingUrl close to session start (15 min before)
  const fifteenMinFromNow = new Date(Date.now() + 15 * 60000);
  const sanitized = sessions.map(s => ({
    ...s,
    meetingUrl: s.startsAt <= fifteenMinFromNow ? s.meetingUrl : null,
  }));

  return NextResponse.json({ data: sanitized });
}, { skipCsrf: true });
