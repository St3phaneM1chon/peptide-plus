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

const createSchema = z.object({
  platform: z.enum(['instagram', 'facebook', 'twitter', 'tiktok', 'linkedin']),
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

  const post = await prisma.socialPost.create({
    data: {
      platform,
      content,
      imageUrl: imageUrl ?? null,
      scheduledAt: new Date(scheduledAt),
      status,
    },
  });

  return NextResponse.json({ post }, { status: 201 });
});
