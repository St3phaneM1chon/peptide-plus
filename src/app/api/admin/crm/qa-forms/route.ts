export const dynamic = 'force-dynamic';

/**
 * CRM QA Forms API
 * GET  /api/admin/crm/qa-forms - List QA forms with score counts
 * POST /api/admin/crm/qa-forms - Create a new QA form
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const criterionSchema = z.object({
  name: z.string().min(1, 'Criterion name is required').max(200),
  maxScore: z.number().min(1).max(100).default(10),
  weight: z.number().min(0).max(10).default(1),
});

const createFormSchema = z.object({
  name: z.string().min(1, 'Form name is required').max(200).trim(),
  description: z.string().max(2000).optional().nullable(),
  criteria: z.array(criterionSchema).min(1, 'At least one criterion is required').max(50),
});

// ---------------------------------------------------------------------------
// GET: List QA forms with score counts
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;
  const isActive = searchParams.get('isActive');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true';
  }

  const [forms, total] = await Promise.all([
    prisma.crmQaForm.findMany({
      where,
      include: {
        _count: {
          select: { scores: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.crmQaForm.count({ where }),
  ]);

  return apiPaginated(forms, page, limit, total, { request });
}, { requiredPermission: 'crm.settings' });

// ---------------------------------------------------------------------------
// POST: Create a QA form
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = createFormSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { name, description, criteria } = parsed.data;

  // Check for duplicate name
  const existing = await prisma.crmQaForm.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });

  if (existing) {
    return apiError('A QA form with this name already exists', ErrorCode.DUPLICATE_ENTRY, {
      status: 409,
      request,
    });
  }

  const form = await prisma.crmQaForm.create({
    data: {
      name,
      description: description ?? null,
      criteria: JSON.parse(JSON.stringify(criteria)),
    },
    include: {
      _count: {
        select: { scores: true },
      },
    },
  });

  logger.info('CRM QA form created', {
    event: 'crm_qa_form_created',
    formId: form.id,
    name,
    criteriaCount: criteria.length,
    userId: session.user.id,
  });

  return apiSuccess(form, { status: 201, request });
}, { requiredPermission: 'crm.settings' });
