export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// PUT /api/admin/format-types/[id] — Update a format type
export const PUT = withAdminGuard(async (request, { params }) => {
  const { id } = await params;

  const existing = await prisma.optionTypeOption.findUnique({ where: { id } });
  if (!existing) {
    return apiError('Format type not found', 404);
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation error', 400, { details: parsed.error.flatten().fieldErrors });
  }

  const updated = await prisma.optionTypeOption.update({
    where: { id },
    data: parsed.data,
  });

  return apiSuccess(updated, { request });
}, { requiredPermission: 'manage_products' });

// DELETE /api/admin/format-types/[id] — Delete a format type (only if unused)
export const DELETE = withAdminGuard(async (request, { params }) => {
  const { id } = await params;

  const existing = await prisma.optionTypeOption.findUnique({ where: { id } });
  if (!existing) {
    return apiError('Format type not found', 404);
  }

  // Check if any ProductOption uses this type
  const usageCount = await prisma.productOption.count({
    where: { optionType: existing.value },
  });

  if (usageCount > 0) {
    return apiError(`Ce type est utilisé par ${usageCount} format(s). Désactivez-le plutôt.`, 409);
  }

  await prisma.optionTypeOption.delete({ where: { id } });

  return apiSuccess({ deleted: true }, { request });
}, { requiredPermission: 'manage_products' });
