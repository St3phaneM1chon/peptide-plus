export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';

const questionSchema = z.object({
  lessonId: z.string().min(1),
  question: z.string().min(10).max(2000),
});

const answerSchema = z.object({
  qaId: z.string().min(1),
  content: z.string().min(1).max(10000),
});

export const GET = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get('lessonId');
  if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 });

  const questions = await prisma.lessonQA.findMany({
    where: { tenantId, lessonId },
    orderBy: [{ isResolved: 'asc' }, { upvotes: 'desc' }, { createdAt: 'desc' }],
    take: 30,
    include: {
      answers: {
        orderBy: [{ isAccepted: 'desc' }, { upvotes: 'desc' }, { createdAt: 'asc' }],
        take: 10,
        select: { id: true, userId: true, content: true, isAccepted: true, isInstructor: true, upvotes: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({ data: questions });
}, { skipCsrf: true });

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await request.json();

  // Answer a question
  if (body.qaId) {
    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    // V2 FIX: Verify QA belongs to same tenant
    const qaCheck = await prisma.lessonQA.findFirst({
      where: { id: parsed.data.qaId, tenantId },
      select: { id: true },
    });
    if (!qaCheck) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    // P8-12 FIX: Detect if user is an instructor
    const isInstructor = !!(await prisma.instructorProfile.findFirst({
      where: { tenantId, userId: session.user.id, isActive: true },
      select: { id: true },
    }));

    const answer = await prisma.lessonQAAnswer.create({
      data: {
        tenantId,
        qaId: parsed.data.qaId,
        userId: session.user.id,
        content: parsed.data.content,
        isInstructor,
      },
    });

    // Create notification for question author
    const qa = await prisma.lessonQA.findUnique({ where: { id: parsed.data.qaId }, select: { userId: true, question: true } });
    if (qa && qa.userId !== session.user.id) {
      await prisma.lmsNotification.create({
        data: {
          tenantId,
          userId: qa.userId,
          type: 'qa_answer',
          title: 'Nouvelle reponse a votre question',
          message: qa.question.slice(0, 100),
        },
      }).catch((e) => { if (typeof console !== "undefined") console.warn("[LMS] Non-blocking op failed:", e instanceof Error ? e.message : e); });
    }

    return NextResponse.json({ data: answer }, { status: 201 });
  }

  // Ask a question
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  // V2 FIX: Verify user has access to this lesson (enrollment check via lesson → chapter → course)
  const lesson = await prisma.lesson.findFirst({
    where: { id: parsed.data.lessonId, tenantId },
    select: { chapter: { select: { courseId: true } } },
  });
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

  const enrollment = await prisma.enrollment.findFirst({
    where: { tenantId, courseId: lesson.chapter.courseId, userId: session.user.id, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });

  const qa = await prisma.lessonQA.create({
    data: {
      tenantId,
      lessonId: parsed.data.lessonId,
      userId: session.user.id,
      question: parsed.data.question,
    },
  });

  return NextResponse.json({ data: qa }, { status: 201 });
});
