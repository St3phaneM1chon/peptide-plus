export const dynamic = 'force-dynamic';
/**
 * API - Forum Post Replies
 * GET: Paginated replies for a specific post
 * POST: Create a reply on a post (authenticated users only)
 *
 * GET is public. POST requires authentication.
 * Supports nested replies via parentReplyId.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import {
  apiError,
  apiPaginated,
  apiSuccess,
  validateContentType,
} from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const createReplySchema = z.object({
  content: z.string().min(2, 'Reply must be at least 2 characters').max(5000, 'Reply must be at most 5,000 characters'),
  parentReplyId: z.string().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '20', 10)),
      100
    );

    // Verify the post exists and is not deleted
    const post = await prisma.forumPost.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true },
    });

    if (!post) {
      return apiError('Post not found', ErrorCode.NOT_FOUND, { request });
    }

    const where = {
      postId,
      deletedAt: null,
    };

    const [replies, total] = await Promise.all([
      prisma.forumReply.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
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
      }),
      prisma.forumReply.count({ where }),
    ]);

    const data = replies.map((reply) => ({
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
    }));

    return apiPaginated(data, page, limit, total, { request });
  } catch (error) {
    console.error('Error fetching replies:', error);
    return apiError(
      'Failed to fetch replies',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params;

    // SEC-FIX: Rate limiting on reply creation to prevent spam/abuse
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/community/replies');
    if (!rl.success) {
      return apiError(rl.error!.message, ErrorCode.RATE_LIMITED, { request });
    }

    // SEC-FIX: CSRF protection on mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return apiError('Invalid CSRF token', ErrorCode.FORBIDDEN, { request });
    }

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

    // Verify the post exists, is not deleted, and is not locked
    const post = await prisma.forumPost.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true, isLocked: true },
    });

    if (!post) {
      return apiError('Post not found', ErrorCode.NOT_FOUND, { request });
    }

    if (post.isLocked) {
      return apiError(
        'This post is locked and cannot receive new replies',
        ErrorCode.FORBIDDEN,
        { request }
      );
    }

    const body = await request.json();
    const parsed = createReplySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.errors[0].message,
        ErrorCode.VALIDATION_ERROR,
        { details: parsed.error.errors.map(e => ({ path: e.path.join('.'), message: e.message })), request }
      );
    }
    const { content, parentReplyId } = parsed.data;

    // If parentReplyId is provided, verify it exists and belongs to this post
    if (parentReplyId) {
      const parentReply = await prisma.forumReply.findFirst({
        where: {
          id: parentReplyId,
          postId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!parentReply) {
        return apiError(
          'Parent reply not found',
          ErrorCode.NOT_FOUND,
          { request }
        );
      }
    }

    // Sanitize user content before storage (defense-in-depth XSS prevention)
    const cleanContent = stripControlChars(stripHtml(content.trim()));

    // Create the reply
    const reply = await prisma.forumReply.create({
      data: {
        content: cleanContent,
        authorId: session.user.id,
        postId,
        parentReplyId: parentReplyId || null,
      },
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
    });

    return apiSuccess(
      {
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
      },
      { status: 201, request }
    );
  } catch (error) {
    console.error('Error creating reply:', error);
    return apiError(
      'Failed to create reply',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}
