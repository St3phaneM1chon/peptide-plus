export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { getCorporateAccountById } from '@/lib/lms/lms-service';

const updateCorporateSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  billingMethod: z.enum(['STRIPE', 'INVOICE', 'PURCHASE_ORDER', 'PREPAID']).optional(),
  paymentTermsDays: z.number().int().min(0).optional(),
  budgetAmount: z.number().min(0).nullable().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;

  const account = await getCorporateAccountById(tenantId, id);
  if (!account) return apiError('Corporate account not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  return apiSuccess(account, { request });
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;
  const body = await request.json();
  const parsed = updateCorporateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const existing = await prisma.corporateAccount.findFirst({ where: { id, tenantId } });
  if (!existing) return apiError('Corporate account not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  const account = await prisma.corporateAccount.update({
    where: { id },
    data: parsed.data,
  });

  return apiSuccess(account, { request });
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;

  const existing = await prisma.corporateAccount.findFirst({ where: { id, tenantId } });
  if (!existing) return apiError('Corporate account not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  await prisma.corporateAccount.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ deactivated: true }, { request });
});
