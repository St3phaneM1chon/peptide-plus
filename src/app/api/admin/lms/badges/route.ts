export const dynamic = 'force-dynamic';

/**
 * Admin Badges API
 * GET    /api/admin/lms/badges        — List all badges
 * POST   /api/admin/lms/badges        — Create badge
 * PUT    /api/admin/lms/badges?id=xxx — Update badge
 * DELETE /api/admin/lms/badges?id=xxx — Deactivate badge
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional(),
  criteria: z.object({
    type: z.enum(['courses_completed', 'quiz_score', 'streak_days', 'lessons_completed', 'xp_earned']),
    value: z.number().min(1),
  }),
});

export const GET = withAdminGuard(async (_request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;

  const badges = await prisma.lmsBadge.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { awards: true } },
    },
  });

  return apiSuccess(badges, { request: _request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  // Check name uniqueness within tenant
  const existing = await prisma.lmsBadge.findFirst({
    where: { tenantId, name: parsed.data.name },
    select: { id: true },
  });
  if (existing) {
    return apiError('A badge with this name already exists', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const badge = await prisma.lmsBadge.create({
    data: {
      tenantId,
      name: parsed.data.name,
      description: parsed.data.description,
      iconUrl: parsed.data.iconUrl,
      criteria: parsed.data.criteria,
    },
  });

  return apiSuccess(badge, { request, status: 201 });
});

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional(),
  criteria: z.object({
    type: z.enum(['courses_completed', 'quiz_score', 'streak_days', 'lessons_completed', 'xp_earned']),
    value: z.number().min(1),
  }).optional(),
  isActive: z.boolean().optional(),
});

// PUT /api/admin/lms/badges?id=xxx — Update an existing badge
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const badgeId = searchParams.get('id');
  if (!badgeId) return apiError('Badge ID required', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const badge = await prisma.lmsBadge.findFirst({
    where: { id: badgeId, tenantId },
    select: { id: true },
  });
  if (!badge) return apiError('Badge not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  // Check name uniqueness within tenant (if name is being changed)
  if (parsed.data.name) {
    const duplicate = await prisma.lmsBadge.findFirst({
      where: { tenantId, name: parsed.data.name, id: { not: badgeId } },
      select: { id: true },
    });
    if (duplicate) {
      return apiError('A badge with this name already exists', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
    }
  }

  const updated = await prisma.lmsBadge.update({
    where: { id: badge.id },
    data: parsed.data,
  });

  return apiSuccess(updated, { request });
});

// Deactivate a badge (soft-delete)
// Admin page sends: DELETE /api/admin/lms/badges?id=xxx
export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const badgeId = searchParams.get('id');
  if (!badgeId) return apiError('Badge ID required', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const badge = await prisma.lmsBadge.findFirst({
    where: { id: badgeId, tenantId },
    select: { id: true },
  });
  if (!badge) return apiError('Badge not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  await prisma.lmsBadge.update({ where: { id: badge.id }, data: { isActive: false } });
  return apiSuccess({ success: true }, { request });
});
