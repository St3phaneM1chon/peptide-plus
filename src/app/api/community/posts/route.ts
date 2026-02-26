export const dynamic = 'force-dynamic';
/**
 * API - Forum Posts
 * GET: Paginated list of posts with filters (category, search, sort)
 * POST: Create a new post (authenticated users only)
 *
 * GET is public. POST requires authentication.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import {
  apiSuccess,
  apiError,
  apiPaginated,
  validateContentType,
} from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import type { Prisma } from '@prisma/client';

const createPostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title must be at most 200 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters').max(10000, 'Content must be at most 10,000 characters'),
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
    const sort = searchParams.get('sort') || 'latest'; // latest | popular | mostViewed

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

    // Build orderBy
    let orderBy: Prisma.ForumPostOrderByWithRelationInput[];
    switch (sort) {
      case 'popular':
        orderBy = [
          { isPinned: 'desc' },
          { upvotes: 'desc' },
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

    const data = posts.map((post) => ({
      id: post.id,
      title: post.title,
      // Return a preview of the content (first 200 chars)
      contentPreview:
        post.content.length > 200
          ? post.content.substring(0, 200) + '...'
          : post.content,
      authorId: post.authorId,
      authorName: post.author.name || 'Anonymous',
      authorAvatar: post.author.image,
      category: {
        id: post.category.id,
        name: post.category.name,
        slug: post.category.slug,
        icon: post.category.icon,
      },
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      viewCount: post.viewCount,
      replyCount: post._count.replies,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));

    return apiPaginated(data, page, limit, total, { request });
  } catch (error) {
    console.error('Error fetching forum posts:', error);
    return apiError(
      'Failed to fetch forum posts',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Verify category exists
    const category = await prisma.forumCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
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
        categoryId,
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
        title: post.title,
        content: post.content,
        authorId: post.authorId,
        authorName: post.author.name || 'Anonymous',
        authorAvatar: post.author.image,
        category: {
          id: post.category.id,
          name: post.category.name,
          slug: post.category.slug,
          icon: post.category.icon,
        },
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        viewCount: post.viewCount,
        replyCount: 0,
        isPinned: post.isPinned,
        isLocked: post.isLocked,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      },
      { status: 201, request }
    );
  } catch (error) {
    console.error('Error creating forum post:', error);
    return apiError(
      'Failed to create forum post',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}
