export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const addEmployeeSchema = z.object({
  userId: z.string(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
});

const bulkAddSchema = z.object({
  employees: z.array(addEmployeeSchema).min(1).max(500),
});

export const GET = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;

  const account = await prisma.corporateAccount.findFirst({ where: { id, tenantId } });
  if (!account) return apiError('Corporate account not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  const employees = await prisma.corporateEmployee.findMany({
    where: { corporateAccountId: id, isActive: true },
    orderBy: { addedAt: 'desc' },
  });

  return apiSuccess(employees, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;
  const body = await request.json();

  const account = await prisma.corporateAccount.findFirst({ where: { id, tenantId } });
  if (!account) return apiError('Corporate account not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  // Support both single and bulk add
  const isBulk = Array.isArray(body.employees);
  const parsed = isBulk
    ? bulkAddSchema.safeParse(body)
    : addEmployeeSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const employeesToAdd = isBulk
    ? (parsed.data as z.infer<typeof bulkAddSchema>).employees
    : [parsed.data as z.infer<typeof addEmployeeSchema>];

  const results = { added: 0, skipped: 0 };

  for (const emp of employeesToAdd) {
    const existing = await prisma.corporateEmployee.findUnique({
      where: { corporateAccountId_userId: { corporateAccountId: id, userId: emp.userId } },
    });

    if (existing) {
      results.skipped++;
      continue;
    }

    await prisma.corporateEmployee.create({
      data: {
        tenantId,
        corporateAccountId: id,
        userId: emp.userId,
        employeeId: emp.employeeId ?? null,
        department: emp.department ?? null,
        role: emp.role ?? 'EMPLOYEE',
        addedBy: session.user.id,
      },
    });
    results.added++;
  }

  return apiSuccess(results, { request, status: 201 });
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) return apiError('userId required', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const employee = await prisma.corporateEmployee.findUnique({
    where: { corporateAccountId_userId: { corporateAccountId: id, userId } },
  });

  if (!employee || employee.tenantId !== tenantId) {
    return apiError('Employee not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  }

  await prisma.corporateEmployee.update({
    where: { id: employee.id },
    data: { isActive: false },
  });

  return apiSuccess({ removed: true }, { request });
});
