export const dynamic = 'force-dynamic';

/**
 * LMS: Student-Facing Peer Review API
 *
 * GET  - List peer review assignments / pending reviews / grades
 * POST - Submit assignment or complete a peer review
 *
 * Flow:
 * 1. Student submits assignment via PeerReviewSubmission
 * 2. System assigns 2 random peers (maxReviewers on PeerReviewAssignment)
 * 3. Peers score with rubric criteria
 * 4. Average of completed reviews = final grade
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const submitReviewSchema = z.object({
  submissionId: z.string().min(1),
  score: z.number().min(0).max(100),
  feedback: z.string().max(5000).optional(),
  rubricScores: z.record(z.number()).optional(),
});

const submitAssignmentSchema = z.object({
  assignmentId: z.string().min(1),
  content: z.string().min(1).max(50000),
  fileUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const view = searchParams.get('view') || 'assignments';

  try {
    if (view === 'assignments') {
      const where: Record<string, unknown> = { isActive: true };
      if (courseId) where.courseId = courseId;

      const assignments = await prisma.peerReviewAssignment.findMany({
        where,
        include: {
          submissions: {
            where: { userId },
            select: { id: true, status: true, submittedAt: true },
          },
          _count: { select: { submissions: true } },
          rubric: { select: { id: true, name: true, maxScore: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return NextResponse.json({
        data: assignments.map((a) => ({
          id: a.id,
          courseId: a.courseId,
          lessonId: a.lessonId,
          title: a.title,
          instructions: a.instructions,
          deadline: a.deadline,
          isAnonymous: a.isAnonymous,
          rubric: a.rubric,
          totalSubmissions: a._count.submissions,
          mySubmission: a.submissions[0] || null,
        })),
      });
    }

    if (view === 'reviews') {
      const pendingReviews = await prisma.peerReview.findMany({
        where: { reviewerId: userId, isComplete: false },
        include: {
          submission: {
            select: {
              id: true,
              content: true,
              fileUrl: true,
              status: true,
              assignment: {
                select: { id: true, title: true, isAnonymous: true, rubricId: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      return NextResponse.json({
        data: pendingReviews.map((r) => ({
          reviewId: r.id,
          submissionId: r.submissionId,
          content: r.submission.content,
          fileUrl: r.submission.fileUrl,
          assignmentTitle: r.submission.assignment.title,
          isAnonymous: r.submission.assignment.isAnonymous,
          rubricId: r.submission.assignment.rubricId,
        })),
      });
    }

    if (view === 'grades') {
      const submissions = await prisma.peerReviewSubmission.findMany({
        where: { userId },
        include: {
          reviews: {
            where: { isComplete: true },
            select: { score: true, feedback: true, rubricScores: true },
          },
          assignment: { select: { title: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 50,
      });

      return NextResponse.json({
        data: submissions.map((s) => {
          const scores = s.reviews
            .map((r) => (r.score ? Number(r.score) : null))
            .filter((n): n is number => n !== null);
          const avgScore = scores.length > 0
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
            : null;

          return {
            submissionId: s.id,
            assignmentTitle: s.assignment.title,
            status: s.status,
            reviewCount: s.reviews.length,
            averageScore: avgScore,
            feedback: s.reviews.map((r) => r.feedback).filter(Boolean),
          };
        }),
      });
    }

    return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 });
  } catch (error) {
    logger.error('[LMS:PeerReview] GET error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const tenantId = (session.user as Record<string, unknown>).tenantId as string | undefined;
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === 'submit_assignment') {
      const parsed = submitAssignmentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }

      const assignment = await prisma.peerReviewAssignment.findFirst({
        where: { id: parsed.data.assignmentId, isActive: true },
        select: { id: true, maxReviewers: true, deadline: true },
      });

      if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
      if (assignment.deadline && new Date() > assignment.deadline) {
        return NextResponse.json({ error: 'Deadline has passed' }, { status: 400 });
      }

      const submission = await prisma.peerReviewSubmission.create({
        data: {
          tenantId,
          assignmentId: parsed.data.assignmentId,
          userId,
          content: parsed.data.content,
          fileUrl: parsed.data.fileUrl || null,
          status: 'submitted',
        },
      });

      // Auto-assign peer reviewers from other students
      const otherSubmissions = await prisma.peerReviewSubmission.findMany({
        where: { assignmentId: parsed.data.assignmentId, userId: { not: userId } },
        select: { userId: true },
        take: 50,
      });

      const shuffled = [...otherSubmissions].sort(() => Math.random() - 0.5);
      const reviewers = shuffled.slice(0, assignment.maxReviewers);

      if (reviewers.length > 0) {
        await prisma.peerReview.createMany({
          data: reviewers.map((r) => ({
            tenantId,
            submissionId: submission.id,
            reviewerId: r.userId,
            isComplete: false,
          })),
          skipDuplicates: true,
        });
      }

      // Assign this student to review others
      const unreviewed = await prisma.peerReviewSubmission.findMany({
        where: {
          assignmentId: parsed.data.assignmentId,
          userId: { not: userId },
          reviews: { none: { reviewerId: userId } },
        },
        select: { id: true },
        take: assignment.maxReviewers,
      });

      if (unreviewed.length > 0) {
        await prisma.peerReview.createMany({
          data: unreviewed.map((s) => ({
            tenantId,
            submissionId: s.id,
            reviewerId: userId,
            isComplete: false,
          })),
          skipDuplicates: true,
        });
      }

      return NextResponse.json({
        data: { submissionId: submission.id, reviewersAssigned: reviewers.length },
      }, { status: 201 });
    }

    if (action === 'submit_review') {
      const parsed = submitReviewSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }

      const review = await prisma.peerReview.findUnique({
        where: {
          submissionId_reviewerId: {
            submissionId: parsed.data.submissionId,
            reviewerId: userId,
          },
        },
        include: {
          submission: {
            select: { id: true, userId: true, assignmentId: true, assignment: { select: { maxReviewers: true } } },
          },
        },
      });

      if (!review) return NextResponse.json({ error: 'Review assignment not found' }, { status: 404 });
      if (review.isComplete) return NextResponse.json({ error: 'Review already submitted' }, { status: 400 });

      await prisma.peerReview.update({
        where: { id: review.id },
        data: {
          score: parsed.data.score,
          feedback: parsed.data.feedback || null,
          rubricScores: parsed.data.rubricScores || undefined,
          isComplete: true,
        },
      });

      // Check if all reviews are complete -> grade the submission
      const completedReviews = await prisma.peerReview.findMany({
        where: { submissionId: parsed.data.submissionId, isComplete: true },
        select: { score: true },
      });

      if (completedReviews.length >= review.submission.assignment.maxReviewers) {
        const scores = completedReviews
          .map((r) => (r.score ? Number(r.score) : null))
          .filter((n): n is number => n !== null);
        const avgScore = scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
          : 0;

        await prisma.peerReviewSubmission.update({
          where: { id: parsed.data.submissionId },
          data: { status: 'graded' },
        });

        logger.info('[LMS:PeerReview] Submission graded', {
          submissionId: parsed.data.submissionId,
          avgScore,
          reviewCount: completedReviews.length,
        });
      }

      return NextResponse.json({ data: { success: true, reviewId: review.id } });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('[LMS:PeerReview] POST error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
