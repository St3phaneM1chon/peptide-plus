export const dynamic = 'force-dynamic';

/**
 * Deduplicate Prospect List
 * POST /api/admin/crm/lists/[id]/deduplicate
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { autoDeduplicateList } from '@/lib/crm/prospect-dedup';

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: listId } = await context.params;

  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  const result = await autoDeduplicateList(listId);

  return apiSuccess(result, { request });
});
