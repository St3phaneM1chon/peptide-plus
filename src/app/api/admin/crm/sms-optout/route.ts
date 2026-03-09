export const dynamic = 'force-dynamic';

/**
 * CRM SMS Opt-Out API
 * GET  /api/admin/crm/sms-optout - List opt-outs (paginated, searchable by phone)
 * POST /api/admin/crm/sms-optout - Add a phone number to the opt-out list
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createOptOutSchema = z.object({
  phone: z.string().min(1, 'Phone is required').max(50).trim(),
  reason: z.string().max(500).trim().optional(),
});

// ---------------------------------------------------------------------------
// GET: List opt-outs
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const search = searchParams.get('search');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (search) {
    where.phone = { contains: search, mode: 'insensitive' };
  }

  const [optOuts, total] = await Promise.all([
    prisma.smsOptOut.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.smsOptOut.count({ where }),
  ]);

  return apiPaginated(optOuts, page, limit, total, { request });
}, { requiredPermission: 'crm.compliance.manage' });

// ---------------------------------------------------------------------------
// POST: Add an opt-out
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createOptOutSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { phone, reason } = parsed.data;

  // Check if phone is already opted out
  const existing = await prisma.smsOptOut.findUnique({
    where: { phone },
  });

  if (existing) {
    return apiError('Phone number is already opted out', ErrorCode.DUPLICATE_ENTRY, {
      request,
    });
  }

  const optOut = await prisma.smsOptOut.create({
    data: {
      phone,
      reason: reason || null,
    },
  });

  return apiSuccess(optOut, { status: 201, request });
}, { requiredPermission: 'crm.compliance.manage' });
