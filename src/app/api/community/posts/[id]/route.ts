export const dynamic = 'force-dynamic';
/**
 * API - Single Forum Post
 * GET: Fetch a single post with replies, author info, and vote counts
 * DELETE: Soft-delete a post (author or admin/owner only)
 *
 * GET is public. DELETE requires authentication + authorization.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const post = await prisma.forumPost.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        content: true,
        authorId: true,
        upvotes: true,
        downvotes: true,
        viewCount: true,
        isPinned: true,
        isLocked: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            authorId: true,
            parentReplyId: true,
            upvotes: true,
            downvotes: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!post) {
      return apiError('Post not found', ErrorCode.NOT_FOUND, { request });
    }

    // Increment view count (fire-and-forget, non-blocking)
    prisma.forumPost
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {
        // Silently ignore view count increment failures
      });

    // Check if the current user has voted on this post
    let currentUserVote: number | null = null;
    const session = await auth();
    if (session?.user?.id) {
      const existingVote = await prisma.forumVote.findUnique({
        where: {
          userId_postId: {
            userId: session.user.id,
            postId: id,
          },
        },
        select: { value: true },
      });
      currentUserVote = existingVote?.value ?? null;
    }

    const data = {
      id: post.id,
      title: post.title,
      content: post.content,
      authorId: post.authorId,
      authorName: post.author.name || 'Anonymous',
      authorAvatar: post.author.image,
      authorRole: post.author.role,
      category: {
        id: post.category.id,
        name: post.category.name,
        slug: post.category.slug,
        icon: post.category.icon,
      },
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      viewCount: post.viewCount + 1, // Include the current view
      replyCount: post._count.replies,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      currentUserVote,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      replies: post.replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        authorId: reply.authorId,
        authorName: reply.author.name || 'Anonymous',
        authorAvatar: reply.author.image,
        authorRole: reply.author.role,
        parentReplyId: reply.parentReplyId,
        upvotes: reply.upvotes,
        downvotes: reply.downvotes,
        createdAt: reply.createdAt.toISOString(),
        updatedAt: reply.updatedAt.toISOString(),
      })),
    };

    return apiSuccess(data, { request });
  } catch (error) {
    console.error('Error fetching forum post:', error);
    return apiError(
      'Failed to fetch forum post',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Authentication required
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Authentication required', ErrorCode.UNAUTHORIZED, {
        request,
      });
    }

    // Find the post
    const post = await prisma.forumPost.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!post) {
      return apiError('Post not found', ErrorCode.NOT_FOUND, { request });
    }

    // Authorization: only the author or admin/owner can delete
    const isAuthor = post.authorId === session.user.id;
    const isAdmin =
      session.user.role === 'OWNER' || session.user.role === 'EMPLOYEE';

    if (!isAuthor && !isAdmin) {
      return apiError(
        'You do not have permission to delete this post',
        ErrorCode.FORBIDDEN,
        { request }
      );
    }

    // Soft-delete by setting deletedAt
    await prisma.forumPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return apiSuccess(
      { message: 'Post deleted successfully' },
      { request }
    );
  } catch (error) {
    console.error('Error deleting forum post:', error);
    return apiError(
      'Failed to delete forum post',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}
