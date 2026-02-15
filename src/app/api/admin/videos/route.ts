export const dynamic = 'force-dynamic';

/**
 * Admin Videos API
 * GET  - List all videos with translations
 * POST - Create a new video
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

// GET /api/admin/videos - List all videos
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const isPublished = searchParams.get('isPublished');
    const isFeatured = searchParams.get('isFeatured');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (isPublished === 'true') {
      where.isPublished = true;
    } else if (isPublished === 'false') {
      where.isPublished = false;
    }

    if (isFeatured === 'true') {
      where.isFeatured = true;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { instructor: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        include: {
          translations: {
            orderBy: { locale: 'asc' },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    // Parse tags for frontend
    const enrichedVideos = videos.map(v => {
      let parsedTags: string[] = [];
      if (v.tags) {
        try {
          parsedTags = JSON.parse(v.tags);
        } catch {
          parsedTags = v.tags.split(',').map(t => t.trim());
        }
      }

      return {
        ...v,
        tags: parsedTags,
      };
    });

    return NextResponse.json({
      videos: enrichedVideos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Admin videos GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/videos - Create a new video
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      thumbnailUrl,
      videoUrl,
      duration,
      category,
      tags,
      instructor,
      isFeatured,
      isPublished,
      locale,
      sortOrder,
      translations,
    } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Ensure slug uniqueness
    let slug = baseSlug;
    let slugSuffix = 1;
    while (await prisma.video.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${slugSuffix}`;
      slugSuffix++;
    }

    // Prepare tags as JSON string
    const tagsJson = tags
      ? (Array.isArray(tags) ? JSON.stringify(tags) : tags)
      : null;

    const video = await prisma.video.create({
      data: {
        title,
        slug,
        description: description || null,
        thumbnailUrl: thumbnailUrl || null,
        videoUrl: videoUrl || null,
        duration: duration || null,
        category: category || null,
        tags: tagsJson,
        instructor: instructor || null,
        isFeatured: isFeatured ?? false,
        isPublished: isPublished ?? false,
        locale: locale || 'en',
        sortOrder: sortOrder ?? 0,
        ...(translations && translations.length > 0
          ? {
              translations: {
                create: translations.map((t: {
                  locale: string;
                  title?: string;
                  description?: string;
                }) => ({
                  locale: t.locale,
                  title: t.title || null,
                  description: t.description || null,
                })),
              },
            }
          : {}),
      },
      include: {
        translations: true,
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error('Admin videos POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
