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

  // P8-08 FIX: Add cursor-based pagination
  const cursor = searchParams.get('cursor');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);

  const discussions = await prisma.courseDiscussion.findMany({
    where: { tenantId, courseId },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
        take: 3,
        select: { id: true, userId: true, content: true, isInstructor: true, upvotes: true, createdAt: true },
      },
    },
  });

  // P8-14 FIX: Resolve user names and strip raw userId from responses
  const allUserIds = new Set<string>();
  for (const d of discussions) {
    allUserIds.add(d.userId);
    for (const r of d.replies) allUserIds.add(r.userId);
  }
  const users = allUserIds.size > 0
    ? await prisma.user.findMany({ where: { id: { in: [...allUserIds] }, tenantId }, select: { id: true, name: true } })
    : [];
  const nameMap = new Map(users.map(u => [u.id, u.name ?? 'Etudiant']));

  const sanitized = discussions.map(d => ({
    id: d.id, title: d.title, content: d.content,
    authorName: nameMap.get(d.userId) ?? 'Etudiant',
    isOwner: d.userId === session.user.id,
    isPinned: d.isPinned, isLocked: d.isLocked,
    replyCount: d.replyCount, createdAt: d.createdAt,
    replies: d.replies.map(r => ({
      id: r.id, content: r.content, isInstructor: r.isInstructor,
      authorName: nameMap.get(r.userId) ?? 'Etudiant',
      isOwner: r.userId === session.user.id,
      upvotes: r.upvotes, createdAt: r.createdAt,
    })),
  }));

  const hasMore = sanitized.length > limit;
  if (hasMore) sanitized.pop();
  const nextCursor = hasMore ? sanitized[sanitized.length - 1]?.id : null;

  return NextResponse.json({ data: sanitized, nextCursor, hasMore });
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

// P8-13 FIX: Delete own discussion or reply
const deleteSchema = z.object({
  discussionId: z.string().min(1).optional(),
  replyId: z.string().min(1).optional(),
}).refine(d => d.discussionId || d.replyId, { message: 'discussionId or replyId required' });

export const DELETE = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  if (parsed.data.replyId) {
    const reply = await prisma.courseDiscussionReply.findFirst({
      where: { id: parsed.data.replyId, tenantId, userId: session.user.id },
      select: { id: true, discussionId: true },
    });
    if (!reply) return NextResponse.json({ error: 'Reply not found or not yours' }, { status: 404 });
    await prisma.$transaction([
      prisma.courseDiscussionReply.delete({ where: { id: reply.id } }),
      prisma.courseDiscussion.update({ where: { id: reply.discussionId }, data: { replyCount: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ success: true });
  }

  if (parsed.data.discussionId) {
    const discussion = await prisma.courseDiscussion.findFirst({
      where: { id: parsed.data.discussionId, tenantId, userId: session.user.id },
      select: { id: true },
    });
    if (!discussion) return NextResponse.json({ error: 'Discussion not found or not yours' }, { status: 404 });
    await prisma.courseDiscussion.delete({ where: { id: discussion.id } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
});
