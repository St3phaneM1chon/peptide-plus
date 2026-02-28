export const dynamic = 'force-dynamic';

/**
 * Social Posts API
 * GET  - List posts (pagination, filters)
 * POST - Create a new post (draft or scheduled)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Chantier 1.3: Support both single platform (string) and multi-platform (array) for cross-posting
const platformEnum = z.enum(['instagram', 'facebook', 'twitter', 'tiktok', 'linkedin']);

const createSchema = z.object({
  platform: z.union([platformEnum, z.array(platformEnum).min(1).max(5)]),
  content: z.string().min(1).max(63206),
  imageUrl: z.string().url().nullable().optional(),
  scheduledAt: z.string().datetime(),
  status: z.enum(['draft', 'scheduled']).default('scheduled'),
});

export const GET = withAdminGuard(async (request: NextRequest) => {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform');
  const status = url.searchParams.get('status');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;
  if (status) where.status = status;

  const [posts, total] = await Promise.all([
    prisma.socialPost.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip,
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.socialPost.count({ where }),
  ]);

  return NextResponse.json({
    posts,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
  }

  const { platform, content, imageUrl, scheduledAt, status } = parsed.data;

  // Chantier 1.3: Cross-post — create one post per platform when array is provided
  const platforms = Array.isArray(platform) ? platform : [platform];

  if (platforms.length === 1) {
    const post = await prisma.socialPost.create({
      data: {
        platform: platforms[0],
        content,
        imageUrl: imageUrl ?? null,
        scheduledAt: new Date(scheduledAt),
        status,
      },
    });
    return NextResponse.json({ post }, { status: 201 });
  }

  // Multi-platform: create all posts in a transaction
  const posts = await prisma.$transaction(
    platforms.map((p) =>
      prisma.socialPost.create({
        data: {
          platform: p,
          content,
          imageUrl: imageUrl ?? null,
          scheduledAt: new Date(scheduledAt),
          status,
        },
      })
    )
  );

  return NextResponse.json({ posts, count: posts.length }, { status: 201 });
});
