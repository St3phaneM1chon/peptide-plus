export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(3).max(300),
  content: z.string().min(10).max(10000),
});

const replySchema = z.object({
  discussionId: z.string().min(1),
  content: z.string().min(1).max(10000),
  parentReplyId: z.string().optional(),
});

export const GET = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  const discussions = await prisma.courseDiscussion.findMany({
    where: { tenantId, courseId },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
        take: 3,
        select: { id: true, userId: true, content: true, isInstructor: true, upvotes: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({ data: discussions });
}, { skipCsrf: true });

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await request.json();

  // Reply to discussion
  if (body.discussionId) {
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    // V2 FIX: Verify discussion belongs to same tenant before replying
    const discussion = await prisma.courseDiscussion.findFirst({
      where: { id: parsed.data.discussionId, tenantId },
      select: { id: true, isLocked: true },
    });
    if (!discussion) return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    if (discussion.isLocked) return NextResponse.json({ error: 'Discussion is locked' }, { status: 403 });

    // P8-03 FIX: Validate parentReplyId belongs to same tenant and discussion
    if (parsed.data.parentReplyId) {
      const parentReply = await prisma.courseDiscussionReply.findFirst({
        where: { id: parsed.data.parentReplyId, tenantId, discussionId: parsed.data.discussionId },
        select: { id: true },
      });
      if (!parentReply) return NextResponse.json({ error: 'Parent reply not found' }, { status: 404 });
    }

    // P8-12 FIX: Detect if user is an instructor
    const isInstructor = !!(await prisma.instructorProfile.findFirst({
      where: { tenantId, userId: session.user.id, isActive: true },
      select: { id: true },
    }));

    // P8-10 FIX: Wrap reply create + replyCount increment in a transaction
    const [reply] = await prisma.$transaction([
      prisma.courseDiscussionReply.create({
        data: {
          tenantId,
          discussionId: parsed.data.discussionId,
          userId: session.user.id,
          content: parsed.data.content,
          parentReplyId: parsed.data.parentReplyId ?? null,
          isInstructor,
        },
      }),
      prisma.courseDiscussion.update({
        where: { id: parsed.data.discussionId },
        data: { replyCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ data: reply }, { status: 201 });
  }

  // New discussion
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  // V2 FIX: Verify user is enrolled in the course before allowing discussion creation
  const enrollment = await prisma.enrollment.findFirst({
    where: { tenantId, courseId: parsed.data.courseId, userId: session.user.id, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!enrollment) return NextResponse.json({ error: 'You must be enrolled in this course' }, { status: 403 });

  const discussion = await prisma.courseDiscussion.create({
    data: {
      tenantId,
      courseId: parsed.data.courseId,
      userId: session.user.id,
      title: parsed.data.title,
      content: parsed.data.content,
    },
  });

  return NextResponse.json({ data: discussion }, { status: 201 });
});
