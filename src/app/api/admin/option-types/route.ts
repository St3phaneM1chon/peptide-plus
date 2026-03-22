export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';

// GET /api/admin/format-types — List all format types
export const GET = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') !== 'false';

  const types = await prisma.optionTypeOption.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { sortOrder: 'asc' },
  });

  return apiSuccess(types, { request });
});

const createSchema = z.object({
  value: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Value must be UPPER_SNAKE_CASE'),
  label: z.string().min(1).max(100),
  sortOrder: z.number().int().min(0).optional(),
});

// POST /api/admin/format-types — Create a new format type
export const POST = withAdminGuard(async (request) => {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation error', 400, { details: parsed.error.flatten().fieldErrors });
  }

  const { value, label, sortOrder } = parsed.data;

  // Check uniqueness
  const existing = await prisma.optionTypeOption.findUnique({ where: { value } });
  if (existing) {
    return apiError('Ce type existe déjà', 409);
  }

  // Auto sort order if not provided
  const finalSort = sortOrder ?? (await prisma.optionTypeOption.count()) + 1;

  const created = await prisma.optionTypeOption.create({
    data: { value, label, sortOrder: finalSort },
  });

  return apiSuccess(created, { request, status: 201 });
}, { requiredPermission: 'manage_products' });
