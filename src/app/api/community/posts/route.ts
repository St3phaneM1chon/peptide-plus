export const dynamic = 'force-dynamic';
/**
 * API - Forum Posts
 * GET: Paginated list of posts with filters (category, search, sort)
 * POST: Create a new post (authenticated users only)
 *
 * GET is public. POST requires authentication.
 *
 * GET response shape (matching frontend expectations):
 *   { posts: [...], total: N, totalPages: N, page: N }
 *
 * POST response shape:
 *   { id, title, content, ... } (the created post)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { apiError, apiSuccess, validateContentType } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const createPostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title must be at most 200 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters').max(10000, 'Content must be at most 10,000 characters'),
  // Frontend sends either a category ID (cuid) or a slug string
  categoryId: z.string().min(1, 'Category is required'),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '20', 10)),
      100
    );
    const categorySlug = searchParams.get('category');
    const search = searchParams.get('search');
    // Frontend sends: newest | popular | replies
    const sort = searchParams.get('sort') || 'newest';

    // Build where clause
    const where: Prisma.ForumPostWhereInput = {
      deletedAt: null,
    };

    // Filter by category slug
    if (categorySlug && categorySlug !== 'all') {
      where.category = { slug: categorySlug };
    }

    // Search in title and content
    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { content: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Build orderBy — frontend sends: newest | popular | replies
    let orderBy: Prisma.ForumPostOrderByWithRelationInput[];
    switch (sort) {
      case 'popular':
        orderBy = [
          { isPinned: 'desc' },
          { upvotes: 'desc' },
          { createdAt: 'desc' },
        ];
        break;
      case 'replies':
        // Sort by most replied — Prisma supports _count ordering
        orderBy = [
          { isPinned: 'desc' },
          { replies: { _count: 'desc' } },
          { createdAt: 'desc' },
        ];
        break;
      case 'mostViewed':
        orderBy = [
          { isPinned: 'desc' },
          { viewCount: 'desc' },
          { createdAt: 'desc' },
        ];
        break;
      case 'newest':
      case 'latest':
      default:
        orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
        break;
    }

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
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
          _count: {
            select: {
              replies: { where: { deletedAt: null } },
            },
          },
        },
      }),
      prisma.forumPost.count({ where }),
    ]);

    // Map to the Post interface the frontend expects:
    //   id, userId, userName, userAvatar, userBadge, title, content,
    //   category (name string), categorySlug, tags, upvotes, downvotes,
    //   replyCount, views, isPinned, createdAt, lastReply
    const mappedPosts = posts.map((post) => ({
      id: post.id,
      userId: post.authorId,
      userName: post.author.name || 'Anonymous',
      userAvatar: post.author.image,
      userBadge: null,
      title: post.title,
      content:
        post.content.length > 200
          ? post.content.substring(0, 200) + '...'
          : post.content,
      category: post.category?.name || 'General',
      categorySlug: post.category?.slug || 'general',
      tags: [] as string[],
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      replyCount: post._count.replies,
      views: post.viewCount,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      createdAt: post.createdAt.toISOString(),
      lastReply: null,
    }));

    const totalPages = Math.ceil(total / limit);

    // Return { posts, total, totalPages, page } at top level
    // (frontend reads data.posts, data.total, data.totalPages from res.json())
    return NextResponse.json({ posts: mappedPosts, total, totalPages, page });
  } catch (error) {
    logger.error('Error fetching forum posts', { error: error instanceof Error ? error.message : String(error) });
    return apiError(
      'Failed to fetch forum posts',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // SEC-FIX: Rate limiting on post creation to prevent spam/abuse
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/community/posts');
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

    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.errors[0].message,
        ErrorCode.VALIDATION_ERROR,
        { details: parsed.error.errors.map(e => ({ path: e.path.join('.'), message: e.message })), request }
      );
    }
    const { title, content, categoryId } = parsed.data;

    // Resolve category: the frontend may send a slug (e.g. "general") or a cuid
    // Try by ID first, then by slug
    let category = await prisma.forumCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, slug: true, icon: true },
    });
    if (!category) {
      category = await prisma.forumCategory.findUnique({
        where: { slug: categoryId },
        select: { id: true, name: true, slug: true, icon: true },
      });
    }
    if (!category) {
      return apiError('Category not found', ErrorCode.NOT_FOUND, { request });
    }

    // Sanitize user content before storage (defense-in-depth XSS prevention)
    const cleanTitle = stripControlChars(stripHtml(title.trim()));
    const cleanContent = stripControlChars(stripHtml(content.trim()));

    // Create the post
    const post = await prisma.forumPost.create({
      data: {
        title: cleanTitle,
        content: cleanContent,
        authorId: session.user.id,
        categoryId: category.id,
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
          select: { id: true, name: true, image: true },
        },
        category: {
          select: { id: true, name: true, slug: true, icon: true },
        },
      },
    });

    return apiSuccess(
      {
        id: post.id,
        userId: post.authorId,
        userName: post.author.name || 'Anonymous',
        userAvatar: post.author.image,
        title: post.title,
        content: post.content,
        category: post.category?.name || 'General',
        categorySlug: post.category?.slug || 'general',
        tags: [],
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        views: post.viewCount,
        replyCount: 0,
        isPinned: post.isPinned,
        isLocked: post.isLocked,
        createdAt: post.createdAt.toISOString(),
        lastReply: null,
      },
      { status: 201, request }
    );
  } catch (error) {
    logger.error('Error creating forum post', { error: error instanceof Error ? error.message : String(error) });
    return apiError(
      'Failed to create forum post',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}
