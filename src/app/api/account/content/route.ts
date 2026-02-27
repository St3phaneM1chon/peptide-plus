export const dynamic = 'force-dynamic';

/**
 * Account Content (Ma Mediatheque) API
 * GET - List all videos accessible to the authenticated client
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';

// GET /api/account/content
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role || 'CUSTOMER';
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || 'en';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = (page - 1) * limit;

    // Build visibility filter based on user role
    const visibilityFilter: string[] = ['PUBLIC'];
    if (['CUSTOMER', 'CLIENT', 'EMPLOYEE', 'OWNER'].includes(userRole)) visibilityFilter.push('CUSTOMERS_ONLY');
    if (['CLIENT', 'EMPLOYEE', 'OWNER'].includes(userRole)) visibilityFilter.push('CLIENTS_ONLY');
    if (['EMPLOYEE', 'OWNER'].includes(userRole)) visibilityFilter.push('EMPLOYEES_ONLY');

    // Videos accessible: published + visible to user's role + customer account placement
    // OR videos where this user is the featured client (their personal videos)
    const where = {
      OR: [
        {
          OR: [
            { status: 'PUBLISHED' as const },
            { isPublished: true },
          ],
          visibility: { in: visibilityFilter as ('PUBLIC' | 'CUSTOMERS_ONLY' | 'CLIENTS_ONLY' | 'EMPLOYEES_ONLY' | 'PRIVATE')[] },
          placements: {
            some: { placement: 'CUSTOMER_ACCOUNT' as const, isActive: true },
          },
        },
        {
          featuredClientId: userId,
          status: { not: 'ARCHIVED' as const },
        },
      ],
    };

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnailUrl: true,
          videoUrl: true,
          duration: true,
          views: true,
          contentType: true,
          source: true,
          createdAt: true,
          translations: {
            where: { locale },
            select: { title: true, description: true },
            take: 1,
          },
          videoCategory: { select: { id: true, name: true, slug: true } },
          videoTags: { select: { tag: true } },
        },
      }),
      prisma.video.count({ where }),
    ]);

    const enriched = videos.map(v => {
      const t = v.translations[0];
      return {
        ...v,
        title: t?.title || v.title,
        description: t?.description || v.description,
        tags: v.videoTags.map(vt => vt.tag),
        translations: undefined,
        videoTags: undefined,
      };
    });

    return NextResponse.json({
      videos: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Account content GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
