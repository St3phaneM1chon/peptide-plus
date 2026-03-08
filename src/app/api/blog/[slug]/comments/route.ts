export const dynamic = 'force-dynamic';

/**
 * Blog Comments API
 * GET  /api/blog/[slug]/comments - List approved comments for a blog post
 * POST /api/blog/[slug]/comments - Submit a new comment (requires auth, moderated)
 *
 * Uses Prisma $queryRaw (tagged template) for a blog_comments table.
 * Table is bootstrapped once via CREATE TABLE IF NOT EXISTS (idempotent).
 * All queries use parameterised Prisma.sql — no $queryRawUnsafe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { stripHtml } from '@/lib/sanitize';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
  parentId: z.string().optional(), // For threaded replies
}).strict();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlogComment {
  id: string;
  blogPostId: string;
  userId: string;
  userName: string;
  content: string;
  parentId: string | null;
  isApproved: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Table bootstrap (runs once per process lifetime)
// ---------------------------------------------------------------------------

let tableEnsured = false;

async function ensureCommentsTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS blog_comments (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "blogPostId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "userName" TEXT NOT NULL,
        content TEXT NOT NULL,
        "parentId" TEXT,
        "isApproved" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_blog_comments_post
      ON blog_comments ("blogPostId", "isApproved")
    `;
    tableEnsured = true;
  } catch (error) {
    logger.error('Failed to ensure blog_comments table', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Query comments from blog_comments table using parameterised $queryRaw.
 * Falls back gracefully if the table doesn't exist yet.
 */
async function getComments(blogPostId: string): Promise<BlogComment[]> {
  try {
    const comments = await prisma.$queryRaw<BlogComment[]>(
      Prisma.sql`SELECT id, "blogPostId", "userId", "userName", content, "parentId", "isApproved", "createdAt"
       FROM blog_comments
       WHERE "blogPostId" = ${blogPostId} AND "isApproved" = true
       ORDER BY "createdAt" ASC`
    );
    return comments;
  } catch {
    // Table doesn't exist yet - return empty
    return [];
  }
}

async function createComment(data: {
  blogPostId: string;
  userId: string;
  userName: string;
  content: string;
  parentId?: string;
}): Promise<{ id: string } | null> {
  try {
    await ensureCommentsTable();

    const parentId = data.parentId || null;
    const result = await prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`INSERT INTO blog_comments ("blogPostId", "userId", "userName", content, "parentId", "isApproved")
       VALUES (${data.blogPostId}, ${data.userId}, ${data.userName}, ${data.content}, ${parentId}, false)
       RETURNING id`
    );

    return result[0] || null;
  } catch (error) {
    logger.error('Failed to create blog comment', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /api/blog/[slug]/comments - List approved comments
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Find the blog post by slug
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    const comments = await getComments(post.id);

    return NextResponse.json({
      data: comments,
      total: comments.length,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    logger.error('Blog comments GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/blog/[slug]/comments - Submit new comment (requires auth)
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Rate limit comment submissions
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/blog/comments');
    if (!rl.success) {
      return NextResponse.json({ error: rl.error!.message }, { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // XSS sanitization — strip all HTML from comment content
    const sanitizedContent = stripHtml(parsed.data.content).trim();
    if (sanitizedContent.length < 1) {
      return NextResponse.json({ error: 'Comment content cannot be empty after sanitization' }, { status: 400 });
    }

    // Find the blog post
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true, isPublished: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    if (!post.isPublished) {
      return NextResponse.json({ error: 'Cannot comment on unpublished posts' }, { status: 400 });
    }

    const result = await createComment({
      blogPostId: post.id,
      userId: session.user.id,
      userName: session.user.name || 'Anonymous',
      content: sanitizedContent,
      parentId: parsed.data.parentId,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    logger.info('Blog comment submitted', {
      event: 'blog_comment_created',
      blogPostSlug: slug,
      commentId: result.id,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      commentId: result.id,
      message: 'Comment submitted for moderation. It will appear after approval.',
    }, { status: 201 });
  } catch (error) {
    logger.error('Blog comments POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
