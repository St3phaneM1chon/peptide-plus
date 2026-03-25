export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { getCorporateAccounts } from '@/lib/lms/lms-service';

const createCorporateSchema = z.object({
  companyName: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  contactEmail: z.string().email(),
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(30).optional(),
  billingMethod: z.enum(['STRIPE', 'INVOICE', 'PURCHASE_ORDER', 'PREPAID']).optional(),
  paymentTermsDays: z.number().int().min(0).optional(),
  budgetAmount: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  companyId: z.string().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const accounts = await getCorporateAccounts(tenantId);
  return apiSuccess(accounts, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createCorporateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const account = await prisma.corporateAccount.create({
    data: {
      tenantId,
      ...parsed.data,
      budgetAmount: parsed.data.budgetAmount ?? null,
      discountPercent: parsed.data.discountPercent ?? 0,
    },
  });

  return apiSuccess(account, { request, status: 201 });
});
