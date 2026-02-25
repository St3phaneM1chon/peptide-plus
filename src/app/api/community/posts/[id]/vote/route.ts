export const dynamic = 'force-dynamic';
/**
 * API - Forum Post Voting
 * POST: Upvote or downvote a post
 *
 * Uses ForumVote.upsert with @@unique([userId, postId]) constraint.
 * Sending the same vote value again removes the vote (toggle behavior).
 * Authenticated users only.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { apiSuccess, apiError, validateContentType } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params;

    // Content-Type validation
    const ctError = validateContentType(request);
    if (ctError) return ctError;

    // Authentication required
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Authentication required', ErrorCode.UNAUTHORIZED, {
        request,
      });
    }

    const body = await request.json();
    const { value } = body as { value?: number };

    // Validate vote value: must be +1 or -1
    if (value !== 1 && value !== -1) {
      return apiError(
        'Vote value must be 1 (upvote) or -1 (downvote)',
        ErrorCode.VALIDATION_ERROR,
        { request }
      );
    }

    // Verify the post exists and is not deleted
    const post = await prisma.forumPost.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true, upvotes: true, downvotes: true },
    });

    if (!post) {
      return apiError('Post not found', ErrorCode.NOT_FOUND, { request });
    }

    const userId = session.user.id;

    // Check if the user already has a vote on this post
    const existingVote = await prisma.forumVote.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
      select: { id: true, value: true },
    });

    let newUpvotes = post.upvotes;
    let newDownvotes = post.downvotes;
    let action: 'voted' | 'changed' | 'removed';
    let currentVote: number | null;

    if (existingVote) {
      if (existingVote.value === value) {
        // Same vote again: toggle off (remove the vote)
        await prisma.$transaction([
          prisma.forumVote.delete({
            where: { id: existingVote.id },
          }),
          prisma.forumPost.update({
            where: { id: postId },
            data:
              value === 1
                ? { upvotes: { decrement: 1 } }
                : { downvotes: { decrement: 1 } },
          }),
        ]);

        if (value === 1) newUpvotes -= 1;
        else newDownvotes -= 1;
        action = 'removed';
        currentVote = null;
      } else {
        // Different vote: change the vote direction
        await prisma.$transaction([
          prisma.forumVote.update({
            where: { id: existingVote.id },
            data: { value },
          }),
          prisma.forumPost.update({
            where: { id: postId },
            data:
              value === 1
                ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 } }
                : { upvotes: { decrement: 1 }, downvotes: { increment: 1 } },
          }),
        ]);

        if (value === 1) {
          newUpvotes += 1;
          newDownvotes -= 1;
        } else {
          newUpvotes -= 1;
          newDownvotes += 1;
        }
        action = 'changed';
        currentVote = value;
      }
    } else {
      // No existing vote: create a new one
      await prisma.$transaction([
        prisma.forumVote.create({
          data: {
            userId,
            postId,
            value,
          },
        }),
        prisma.forumPost.update({
          where: { id: postId },
          data:
            value === 1
              ? { upvotes: { increment: 1 } }
              : { downvotes: { increment: 1 } },
        }),
      ]);

      if (value === 1) newUpvotes += 1;
      else newDownvotes += 1;
      action = 'voted';
      currentVote = value;
    }

    return apiSuccess(
      {
        postId,
        action,
        currentVote,
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        score: newUpvotes - newDownvotes,
      },
      { request }
    );
  } catch (error) {
    console.error('Error voting on forum post:', error);
    return apiError(
      'Failed to vote on post',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}
