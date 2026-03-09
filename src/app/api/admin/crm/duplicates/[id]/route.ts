export const dynamic = 'force-dynamic';

/**
 * CRM Duplicate Detection - Single Lead API
 * GET  /api/admin/crm/duplicates/[id] - Find duplicates for a specific lead
 * POST /api/admin/crm/duplicates/[id] - Merge two leads
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { findDuplicatesForLead, mergeLeads } from '@/lib/crm/dedup-engine';

// ---------------------------------------------------------------------------
// GET: Find duplicates for a specific lead
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const duplicates = await findDuplicatesForLead(id);

  return apiSuccess(duplicates, { request });
}, { requiredPermission: 'crm.compliance.manage' });

// ---------------------------------------------------------------------------
// POST: Merge two leads (keep survivor, absorb merged)
// ---------------------------------------------------------------------------

const mergeLeadsSchema = z.object({
  survivorId: z.string().min(1, 'survivorId required'),
  mergedId: z.string().min(1, 'mergedId required'),
});

export const POST = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'VALIDATION_ERROR', { status: 400, request });
  }

  const parsed = mergeLeadsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(
      parsed.error.errors[0]?.message || 'Invalid merge data',
      'VALIDATION_ERROR',
      { status: 400, request }
    );
  }

  const { survivorId, mergedId } = parsed.data;

  // Ensure at least one of the IDs matches the route param
  if (survivorId !== id && mergedId !== id) {
    return apiError(
      'Route id must match either survivorId or mergedId',
      'VALIDATION_ERROR',
      { status: 400, request }
    );
  }

  const result = await mergeLeads(survivorId, mergedId);

  return apiSuccess(result, { request });
}, { requiredPermission: 'crm.compliance.manage' });
