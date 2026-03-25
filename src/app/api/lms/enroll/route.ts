export const dynamic = 'force-dynamic';

/**
 * Student self-enrollment API
 * POST /api/lms/enroll — Enroll in a course (authenticated students only)
 *
 * SEC-HARDENING: Wrapped with withUserGuard for centralized auth + CSRF + rate limiting.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { enrollUser } from '@/lib/lms/lms-service';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { buildEnrollmentConfirmationEmail } from '@/lib/email/templates/lms-emails';
import { prisma } from '@/lib/db';

const enrollSchema = z.object({
  courseId: z.string().min(1),
});

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  try {
    const enrollment = await enrollUser(tenantId, parsed.data.courseId, session.user.id!);

    // Send enrollment confirmation email (non-blocking)
    const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId }, select: { title: true, slug: true } });
    if (session.user.email && course) {
      const email = buildEnrollmentConfirmationEmail({
        studentName: session.user.name ?? 'Etudiant',
        courseName: course.title,
        courseSlug: course.slug,
      });
      sendEmail({ to: { email: session.user.email, name: session.user.name ?? undefined }, subject: email.subject, html: email.html, text: email.text }).catch((e) => { if (typeof console !== "undefined") console.warn("[LMS] Non-blocking op failed:", e instanceof Error ? e.message : e); });
    }

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    // C2-SEC-S-005 FIX: Don't expose raw error.message to clients — log it server-side
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('LMS enrollment failed', { courseId: parsed.data.courseId, userId: session.user.id, error: errorMsg });

    // Return safe user-facing messages for known business errors only
    const safeMessages = ['Already enrolled', 'Course not found', 'Course is full', 'Enrollment closed'];
    const isSafeMessage = safeMessages.some(msg => errorMsg.includes(msg));

    return NextResponse.json(
      { error: isSafeMessage ? errorMsg : 'Enrollment failed' },
      { status: isSafeMessage ? 400 : 500 }
    );
  }
}, { rateLimit: 30 });
