export const dynamic = 'force-dynamic';

/**
 * Social Post by ID
 * PATCH  - Update a post
 * DELETE - Delete a post
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  platform: z.enum(['instagram', 'facebook', 'twitter', 'tiktok', 'linkedin']).optional(),
  content: z.string().min(1).max(63206).optional(),
  imageUrl: z.string().url().nullable().optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(['draft', 'scheduled']).optional(),
}).strict();

export const PATCH = withAdminGuard(async (request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.socialPost.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Only allow editing draft/scheduled posts
  if (!['draft', 'scheduled'].includes(existing.status)) {
    return NextResponse.json({ error: 'Cannot edit a published or publishing post' }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.scheduledAt) {
    data.scheduledAt = new Date(data.scheduledAt as string);
  }

  const post = await prisma.socialPost.update({ where: { id }, data });

  return NextResponse.json({ post });
});

export const DELETE = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;

  const existing = await prisma.socialPost.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  await prisma.socialPost.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
