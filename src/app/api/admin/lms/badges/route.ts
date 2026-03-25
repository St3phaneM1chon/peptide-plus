export const dynamic = 'force-dynamic';

/**
 * Admin Badges API
 * GET  /api/admin/lms/badges — List all badges
 * POST /api/admin/lms/badges — Create badge
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
