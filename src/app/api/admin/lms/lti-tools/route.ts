export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createToolSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  issuer: z.string().url(),
  clientId: z.string().min(1),
  deploymentId: z.string().optional(),
  authLoginUrl: z.string().url(),
  authTokenUrl: z.string().url(),
  jwksUrl: z.string().url(),
  publicKey: z.string().optional(),
  customParams: z.record(z.string()).optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const tools = await prisma.ltiTool.findMany({
    where: { tenantId, isActive: true },
    include: { _count: { select: { launches: true } } },
    orderBy: { name: 'asc' },
  });
  return apiSuccess(tools, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createToolSchema.safeParse(body);

  if (!parsed.success) return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });

  const tool = await prisma.ltiTool.create({
    data: { tenantId, ...parsed.data },
  });

  return apiSuccess(tool, { request, status: 201 });
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return apiError('id required', ErrorCode.VALIDATION_ERROR, { request });

  const existing = await prisma.ltiTool.findFirst({
    where: { id, tenantId },
  });

  if (!existing) return apiError('LtiTool not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  await prisma.ltiTool.update({
    where: { id },
    data: { isActive: false },
  });

  return apiSuccess({ success: true }, { request });
});
