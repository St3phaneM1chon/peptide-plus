export const dynamic = 'force-dynamic';

/**
 * LMS Calendar Feed (iCal)
 * GET /api/lms/calendar?userId=xxx&token=xxx — iCal feed for deadlines, sessions, reviews
 * Can be subscribed to in Google Calendar, Outlook, Apple Calendar
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const token = searchParams.get('token'); // Simple auth token (stored in user preferences)

  if (!userId || !token) {
    return NextResponse.json({ error: 'userId and token required' }, { status: 400 });
  }

  // FIX P0: Verify token — use HMAC of userId + secret as calendar token
  const { createHmac } = await import('crypto');
  const secret = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || 'fallback-secret';
  const expectedToken = createHmac('sha256', secret).update(userId).digest('hex').slice(0, 32);
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    // FIX P2: Don't fetch email (PII minimization)
    select: { id: true, name: true, tenantId: true },
  });
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const tenantId = user.tenantId;

  // Fetch upcoming deadlines
  const enrollments = await prisma.enrollment.findMany({
    where: { tenantId, userId, status: 'ACTIVE', complianceDeadline: { not: null } },
    include: { course: { select: { title: true, slug: true } } },
  });

  // Fetch upcoming study reminders
  const reminders = await prisma.studyReminder.findMany({
    where: { tenantId, userId, status: 'PENDING', scheduledAt: { gte: new Date() } },
    take: 50,
  });

  // Build iCal
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Aptitudes';
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://attitudes.vip';

  let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Aptitudes//LMS Calendar//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${siteName} - Formations
X-WR-TIMEZONE:America/Toronto
`;

  // Compliance deadlines
  for (const enrollment of enrollments) {
    if (!enrollment.complianceDeadline) continue;
    const dt = formatICalDate(enrollment.complianceDeadline);
    const uid = `deadline-${enrollment.id}@${new URL(siteUrl).hostname}`;
    ical += `BEGIN:VEVENT
UID:${uid}
DTSTART;VALUE=DATE:${dt}
DTEND;VALUE=DATE:${dt}
SUMMARY:Echeance: ${escapeIcal(enrollment.course.title)}
DESCRIPTION:Date limite pour completer le cours ${escapeIcal(enrollment.course.title)}.\\nProgression: ${Number(enrollment.progress).toFixed(0)}%
URL:${siteUrl}/learn/${enrollment.course.slug}
BEGIN:VALARM
TRIGGER:-P7D
ACTION:DISPLAY
DESCRIPTION:Echeance dans 7 jours: ${escapeIcal(enrollment.course.title)}
END:VALARM
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Echeance demain: ${escapeIcal(enrollment.course.title)}
END:VALARM
END:VEVENT
`;
  }

  // Study reminders
  for (const reminder of reminders) {
    const dt = formatICalDateTime(reminder.scheduledAt);
    const uid = `reminder-${reminder.id}@${new URL(siteUrl).hostname}`;
    ical += `BEGIN:VEVENT
UID:${uid}
DTSTART:${dt}
DTEND:${dt}
SUMMARY:Rappel etude - Aptitudes
DESCRIPTION:Session d'etude planifiee
END:VEVENT
`;
  }

  ical += 'END:VCALENDAR';

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="aptitudes-calendar.ics"',
    },
  });
}

function formatICalDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatICalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcal(text: string): string {
  return text.replace(/[\\;,\n]/g, (c) => {
    if (c === '\n') return '\\n';
    return '\\' + c;
  });
}
