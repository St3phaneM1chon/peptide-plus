export const dynamic = 'force-dynamic';

/**
 * P8-07 FIX: Upvote/downvote API for discussions, replies, Q&A, answers.
 * POST /api/lms/vote — Toggle upvote on a target
 *
 * Since there's no LmsVote tracking table yet, this uses simple increment.
 * Future: add LmsVote model for deduplication.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';

const voteSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(['discussion_reply', 'qa', 'qa_answer']),
});

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await request.json();
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { targetId, targetType } = parsed.data;

  switch (targetType) {
    case 'discussion_reply': {
      const reply = await prisma.courseDiscussionReply.findFirst({
        where: { id: targetId, tenantId },
        select: { id: true },
      });
      if (!reply) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await prisma.courseDiscussionReply.update({
        where: { id: targetId },
        data: { upvotes: { increment: 1 } },
      });
      break;
    }
    case 'qa': {
      const qa = await prisma.lessonQA.findFirst({
        where: { id: targetId, tenantId },
        select: { id: true },
      });
      if (!qa) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await prisma.lessonQA.update({
        where: { id: targetId },
        data: { upvotes: { increment: 1 } },
      });
      break;
    }
    case 'qa_answer': {
      const answer = await prisma.lessonQAAnswer.findFirst({
        where: { id: targetId, tenantId },
        select: { id: true },
      });
      if (!answer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await prisma.lessonQAAnswer.update({
        where: { id: targetId },
        data: { upvotes: { increment: 1 } },
      });
      break;
    }
  }

  return NextResponse.json({ success: true });
});
