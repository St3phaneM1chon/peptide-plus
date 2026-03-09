export const dynamic = 'force-dynamic';

/**
 * CRM Duplicate Detection API
 * GET /api/admin/crm/duplicates - Scan all leads for duplicates
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess } from '@/lib/api-response';
import { scanAllDuplicates } from '@/lib/crm/dedup-engine';

// ---------------------------------------------------------------------------
// GET: Scan for duplicate leads
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

  const duplicates = await scanAllDuplicates(limit);

  return apiSuccess(duplicates, { request });
}, { requiredPermission: 'crm.compliance.manage' });
