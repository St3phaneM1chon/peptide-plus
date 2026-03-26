export const dynamic = 'force-dynamic';

/**
 * Admin LMS Media API
 * GET  /api/admin/lms/media — List media files for tenant (images, videos, documents)
 * POST /api/admin/lms/media — Register a media reference (URL-based, not file upload)
 *
 * Uses the existing Media model (prisma/schema/media.prisma) which has tenantId support.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createMediaSchema = z.object({
  filename: z.string().min(1).max(500),
  originalName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  size: z.number().int().min(0),
  url: z.string().url(),
  alt: z.string().max(500).optional(),
  folder: z.string().max(100).optional(),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder') ?? undefined;
  const mimeType = searchParams.get('mimeType') ?? undefined;
  const search = searchParams.get('search') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  const where = {
    tenantId,
    ...(folder && { folder }),
    ...(mimeType && { mimeType: { startsWith: mimeType } }),
    ...(search && {
      OR: [
        { originalName: { contains: search, mode: 'insensitive' as const } },
        { alt: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.media.count({ where }),
  ]);

  return apiSuccess(
    { media, total, page, limit, totalPages: Math.ceil(total / limit) },
    { request }
  );
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createMediaSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const media = await prisma.media.create({
    data: {
      tenantId,
      filename: parsed.data.filename,
      originalName: parsed.data.originalName,
      mimeType: parsed.data.mimeType,
      size: parsed.data.size,
      url: parsed.data.url,
      alt: parsed.data.alt,
      folder: parsed.data.folder ?? 'lms',
      uploadedBy: session.user.id,
      width: parsed.data.width,
      height: parsed.data.height,
    },
  });

  return apiSuccess(media, { request, status: 201 });
});
