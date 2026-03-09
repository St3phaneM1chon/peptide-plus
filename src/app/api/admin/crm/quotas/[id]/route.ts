export const dynamic = 'force-dynamic';

/**
 * CRM Quota Detail API
 * PATCH  /api/admin/crm/quotas/[id] - Update quota target or actual
 * DELETE /api/admin/crm/quotas/[id] - Delete quota
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError, apiNoContent } from '@/lib/api-response';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// PATCH: Update quota
// ---------------------------------------------------------------------------

export const PATCH = withAdminGuard(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const { id } = params;
  const body = await request.json();

  const existing = await prisma.crmQuota.findUnique({ where: { id } });
  if (!existing) {
    return apiError('Quota not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if (body.target !== undefined) {
    updateData.target = Number(body.target);
  }
  if (body.actual !== undefined) {
    updateData.actual = Number(body.actual);
  }

  if (Object.keys(updateData).length === 0) {
    return apiError('No valid fields to update. Provide target or actual.', 'VALIDATION_ERROR', {
      status: 400,
      request,
    });
  }

  const updated = await prisma.crmQuota.update({
    where: { id },
    data: updateData,
    include: {
      agent: {
        select: { name: true },
      },
    },
  });

  return apiSuccess(updated, { request });
}, { requiredPermission: 'crm.reports.view' });

// ---------------------------------------------------------------------------
// DELETE: Delete quota
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const { id } = params;

  const existing = await prisma.crmQuota.findUnique({ where: { id } });
  if (!existing) {
    return apiError('Quota not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  await prisma.crmQuota.delete({ where: { id } });

  return apiNoContent({ request });
}, { requiredPermission: 'crm.reports.view' });
