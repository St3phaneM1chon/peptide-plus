export const dynamic = 'force-dynamic';

/**
 * Admin Certificate Templates API
 * GET   /api/admin/lms/certificate-templates — List templates for tenant
 * POST  /api/admin/lms/certificate-templates — Create a new template
 * PATCH /api/admin/lms/certificate-templates — Update an existing template
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  htmlTemplate: z.string().min(1),
  cssStyles: z.string().optional(),
  logoUrl: z.string().url().optional(),
  signatureUrl: z.string().url().optional(),
  signerName: z.string().max(200).optional(),
  signerTitle: z.string().max(200).optional(),
  orientation: z.enum(['landscape', 'portrait']).optional(),
  paperSize: z.string().max(10).optional(),
  isDefault: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  htmlTemplate: z.string().min(1).optional(),
  cssStyles: z.string().optional(),
  logoUrl: z.string().url().nullable().optional(),
  signatureUrl: z.string().url().nullable().optional(),
  signerName: z.string().max(200).nullable().optional(),
  signerTitle: z.string().max(200).nullable().optional(),
  orientation: z.enum(['landscape', 'portrait']).optional(),
  paperSize: z.string().max(10).optional(),
  isDefault: z.boolean().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  const where = { tenantId };

  const [templates, total] = await Promise.all([
    prisma.certificateTemplate.findMany({
      where,
      include: {
        _count: { select: { courses: true, certificates: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.certificateTemplate.count({ where }),
  ]);

  return apiSuccess(
    { templates, total, page, limit, totalPages: Math.ceil(total / limit) },
    { request }
  );
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  // If setting as default, unset any existing default for this tenant
  if (parsed.data.isDefault) {
    await prisma.certificateTemplate.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  try {
    const template = await prisma.certificateTemplate.create({
      data: {
        tenantId,
        name: parsed.data.name,
        description: parsed.data.description,
        htmlTemplate: parsed.data.htmlTemplate,
        cssStyles: parsed.data.cssStyles,
        logoUrl: parsed.data.logoUrl,
        signatureUrl: parsed.data.signatureUrl,
        signerName: parsed.data.signerName,
        signerTitle: parsed.data.signerTitle,
        orientation: parsed.data.orientation ?? 'landscape',
        paperSize: parsed.data.paperSize ?? 'A4',
        isDefault: parsed.data.isDefault ?? false,
      },
    });

    return apiSuccess(template, { request, status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return apiError('A template with this name already exists for this tenant', ErrorCode.CONFLICT, { request, status: 409 });
    }
    throw error;
  }
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const existing = await prisma.certificateTemplate.findFirst({
    where: { id: parsed.data.id, tenantId },
  });
  if (!existing) {
    return apiError('Template not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  }

  const { id, ...updateData } = parsed.data;

  // If setting as default, unset any existing default for this tenant
  if (updateData.isDefault) {
    await prisma.certificateTemplate.updateMany({
      where: { tenantId, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.certificateTemplate.update({
    where: { id },
    data: updateData,
  });

  return apiSuccess(updated, { request });
});

// DELETE /api/admin/lms/certificate-templates?id=xxx
export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Template ID required', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const template = await prisma.certificateTemplate.findFirst({
    where: { id, tenantId },
    select: { id: true, _count: { select: { certificates: true } } },
  });
  if (!template) return apiError('Template not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  if (template._count.certificates > 0) {
    return apiError('Cannot delete template with existing certificates', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  await prisma.certificateTemplate.delete({ where: { id } });
  return apiSuccess({ success: true }, { request });
});

// Admin pages send PUT for updates — alias to PATCH handler
export const PUT = PATCH;
