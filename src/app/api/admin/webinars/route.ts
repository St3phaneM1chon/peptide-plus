export const dynamic = 'force-dynamic';

/**
 * Admin Webinars API
 * GET  - List all webinars with translations
 * POST - Create a new webinar
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { enqueue } from '@/lib/translation';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/webinars - List all webinars
export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // DRAFT, SCHEDULED, LIVE, COMPLETED, CANCELLED
    const search = searchParams.get('search');
    const isFeatured = searchParams.get('isFeatured');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Map status to model fields
    if (status) {
      switch (status) {
        case 'DRAFT':
          where.isPublished = false;
          where.isLive = false;
          break;
        case 'SCHEDULED':
          where.isPublished = true;
          where.isLive = false;
          where.scheduledAt = { gt: new Date() };
          break;
        case 'LIVE':
          where.isLive = true;
          break;
        case 'COMPLETED':
          where.isPublished = true;
          where.isLive = false;
          where.scheduledAt = { lt: new Date() };
          break;
        case 'CANCELLED':
          // If you add a cancelled field later; for now filter published=false with past date
          where.isPublished = false;
          where.scheduledAt = { lt: new Date() };
          break;
      }
    }

    if (isFeatured === 'true') {
      where.isFeatured = true;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { speaker: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [webinars, total] = await Promise.all([
      prisma.webinar.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { scheduledAt: 'desc' },
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
      prisma.webinar.count({ where }),
    ]);

    // Derive status for frontend
    const enrichedWebinars = webinars.map(w => {
      let derivedStatus: string;
      if (w.isLive) {
        derivedStatus = 'LIVE';
      } else if (!w.isPublished && (!w.scheduledAt || w.scheduledAt > new Date())) {
        derivedStatus = 'DRAFT';
      } else if (w.isPublished && w.scheduledAt && w.scheduledAt > new Date()) {
        derivedStatus = 'SCHEDULED';
      } else if (w.isPublished && w.scheduledAt && w.scheduledAt <= new Date()) {
        derivedStatus = 'COMPLETED';
      } else if (!w.isPublished && w.scheduledAt && w.scheduledAt <= new Date()) {
        derivedStatus = 'CANCELLED';
      } else {
        derivedStatus = 'DRAFT';
      }

      // Parse tags JSON
      let parsedTags: string[] = [];
      if (w.tags) {
        try {
          parsedTags = JSON.parse(w.tags);
        } catch {
          parsedTags = w.tags.split(',').map(t => t.trim());
        }
      }

      return {
        ...w,
        status: derivedStatus,
        tags: parsedTags,
      };
    });

    return NextResponse.json({
      webinars: enrichedWebinars,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Admin webinars GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/webinars - Create a new webinar
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const {
      title,
      description,
      speaker,
      speakerTitle,
      speakerImage,
      scheduledAt,
      duration,
      category,
      tags,
      registrationUrl,
      recordingUrl,
      thumbnailUrl,
      maxAttendees,
      isFeatured,
      isPublished,
      isLive,
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
    while (await prisma.webinar.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${slugSuffix}`;
      slugSuffix++;
    }

    // Prepare tags as JSON string
    const tagsJson = tags
      ? (Array.isArray(tags) ? JSON.stringify(tags) : tags)
      : null;

    const webinar = await prisma.webinar.create({
      data: {
        title,
        slug,
        description: description || null,
        speaker: speaker || null,
        speakerTitle: speakerTitle || null,
        speakerImage: speakerImage || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        duration: duration ? parseInt(String(duration), 10) : null,
        category: category || null,
        tags: tagsJson,
        registrationUrl: registrationUrl || null,
        recordingUrl: recordingUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        maxAttendees: maxAttendees ? parseInt(String(maxAttendees), 10) : null,
        isFeatured: isFeatured ?? false,
        isPublished: isPublished ?? false,
        isLive: isLive ?? false,
        locale: locale || 'en',
        sortOrder: sortOrder ?? 0,
        ...(translations && translations.length > 0
          ? {
              translations: {
                create: translations.map((t: {
                  locale: string;
                  title?: string;
                  description?: string;
                  speakerTitle?: string;
                }) => ({
                  locale: t.locale,
                  title: t.title || null,
                  description: t.description || null,
                  speakerTitle: t.speakerTitle || null,
                })),
              },
            }
          : {}),
      },
      include: {
        translations: true,
      },
    });

    // Auto-enqueue translation for all 21 locales
    enqueue.webinar(webinar.id);

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_WEBINAR',
      targetType: 'Webinar',
      targetId: webinar.id,
      newValue: { title, slug: webinar.slug, speaker, category, isPublished: webinar.isPublished },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ webinar }, { status: 201 });
  } catch (error) {
    logger.error('Admin webinars POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
